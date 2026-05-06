import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { exec, spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import os from "os";

const execPromise = promisify(exec);
// In the esbuild CJS bundle, import.meta.url is undefined — fall back to process.argv[1]
const __filename = ((): string => {
  try { return fileURLToPath(import.meta.url); } catch { return process.argv[1] ?? ''; }
})();
const __dirname = path.dirname(__filename);

/** Config file path for persisting projectRoot and other state across server restarts. */
const CONFIG_DIR = path.join(os.homedir(), '.nexus-ai-editor');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/** Load persisted state from disk. */
async function loadConfig(): Promise<{ projectRoot?: string }> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/** Save state to disk. */
async function saveConfig(config: { projectRoot?: string }): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('[config] Failed to save:', (err as Error).message);
  }
}

/** Mutable project root — set via /api/set-root after user picks a folder or clones a repo.
 *  Persisted to disk so it survives server restarts. */
let projectRoot = "";

// ── Terminal session registry ────────────────────────────────────────────────
interface TerminalSession {
  process: ChildProcess;
  command: string;
  startTime: Date;
  cwd: string;
  /** Buffered lines so late SSE subscribers get the full history. */
  buffer: Array<{ type: 'out' | 'err' | 'exit'; text: string }>;
  done: boolean;
  clients: Set<import('express').Response>;
}
const terminalSessions = new Map<string, TerminalSession>();

function sessionPush(id: string, type: 'out' | 'err' | 'exit', text: string) {
  const s = terminalSessions.get(id);
  if (!s) return;
  s.buffer.push({ type, text });
  if (type === 'exit') s.done = true;
  const payload = `data: ${JSON.stringify({ type, text })}\n\n`;
  s.clients.forEach(res => { try { res.write(payload); } catch {} });
  if (type === 'exit') {
    s.clients.forEach(res => { try { res.end(); } catch {} });
    // Keep session record for 60 s so clients can read exit status
    setTimeout(() => terminalSessions.delete(id), 60_000);
  }
}

async function startServer() {
  // Load persisted projectRoot from previous session
  const config = await loadConfig();
  if (config.projectRoot) {
    try {
      const stats = await fs.stat(config.projectRoot);
      if (stats.isDirectory()) {
        projectRoot = config.projectRoot;
        console.log(`[config] Restored projectRoot: ${projectRoot}`);
      }
    } catch {
      // Directory no longer exists or is inaccessible
      console.warn(`[config] Saved projectRoot no longer accessible: ${config.projectRoot}`);
      await saveConfig({}); // Clear the bad config
    }
  }

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // Log every request so we can confirm routes are being hit
  app.use((req, _res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
  });

  // ── Root management ──────────────────────────────────────────────────────
  app.get("/api/get-root", (_req, res) => {
    res.json({ root: projectRoot });
  });

  app.post("/api/set-root", async (req, res) => {
    try {
      const { folderPath } = (req.body as { folderPath?: unknown }) || {};
      if (!folderPath || typeof folderPath !== "string") {
        return res.status(400).json({ error: "folderPath is required" });
      }
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: "Path is not a directory" });
      }
      projectRoot = path.resolve(folderPath);
      // Persist the new projectRoot to disk
      await saveConfig({ projectRoot });
      return res.json({ success: true, root: projectRoot });
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  });

  // API Routes
  app.get("/api/files", async (req, res) => {
    if (!projectRoot) return res.json([]);
    try {
      const walk = async (dir: string): Promise<any[]> => {
        const files = await fs.readdir(dir);
        const result = [];
        for (const file of files) {
          if (file === "node_modules" || file === ".git" || file === "dist") continue;
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          if (stats.isDirectory()) {
            result.push({
              name: file,
              type: "directory",
              path: path.relative(projectRoot, filePath),
              children: await walk(filePath),
            });
          } else {
            result.push({
              name: file,
              type: "file",
              path: path.relative(projectRoot, filePath),
            });
          }
        }
        return result;
      };
      const fileTree = await walk(projectRoot);
      res.json(fileTree);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/read-file", async (req, res) => {
    if (!projectRoot) return res.status(400).json({ error: "No project folder open" });
    const { filePath } = req.body;
    try {
      const absolutePath = path.resolve(projectRoot, filePath);
      if (!absolutePath.startsWith(projectRoot)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const content = await fs.readFile(absolutePath, "utf-8");
      res.json({ content });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/write-file", async (req, res) => {
    const { filePath, content } = req.body;
    try {
      const absolutePath = path.resolve(projectRoot, filePath);
      if (!absolutePath.startsWith(projectRoot)) {
        return res.status(403).json({ error: "Access denied" });
      }
      await fs.writeFile(absolutePath, content, "utf-8");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Spawn a command and return a sessionId for SSE streaming
  app.post("/api/terminal", (req, res) => {
    if (!projectRoot) return res.status(400).json({ error: "No project folder open" });
    const { command, cwd: reqCwd } = (req.body as { command?: unknown; cwd?: unknown }) || {};
    if (!command || typeof command !== "string") {
      return res.status(400).json({ error: "command is required" });
    }
    let execCwd = projectRoot;
    if (reqCwd && typeof reqCwd === "string") {
      const resolved = path.resolve(projectRoot, reqCwd);
      if (resolved.startsWith(projectRoot)) execCwd = resolved;
    }
    const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const isWin = process.platform === 'win32';
    const proc = spawn(isWin ? 'cmd' : 'sh', isWin ? ['/c', command] : ['-c', command], {
      cwd: execCwd,
      env: process.env,
      windowsHide: true,
    });
    const session: TerminalSession = {
      process: proc, command, startTime: new Date(), cwd: execCwd,
      buffer: [], done: false, clients: new Set(),
    };
    terminalSessions.set(sessionId, session);
    proc.stdout?.on('data', (d: Buffer) => sessionPush(sessionId, 'out', d.toString()));
    proc.stderr?.on('data', (d: Buffer) => sessionPush(sessionId, 'err', d.toString()));
    proc.on('close', (code) => sessionPush(sessionId, 'exit', String(code ?? 0)));
    proc.on('error', (err) => sessionPush(sessionId, 'err', err.message));
    res.json({ sessionId, cwd: execCwd });
  });

  // SSE stream — replays buffer then streams live output
  app.get("/api/terminal/stream/:sessionId", (req, res) => {
    const session = terminalSessions.get(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    // Replay buffered output
    for (const item of session.buffer) {
      res.write(`data: ${JSON.stringify(item)}\n\n`);
    }
    if (session.done) { res.end(); return; }
    session.clients.add(res);
    req.on('close', () => session.clients.delete(res));
  });

  // Kill a running session (Ctrl+C equivalent)
  app.post("/api/terminal/kill/:sessionId", (req, res) => {
    const session = terminalSessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    try {
      if (process.platform === 'win32') {
        // On Windows, kill the process tree
        spawn('taskkill', ['/pid', String(session.process.pid), '/f', '/t']);
      } else {
        session.process.kill('SIGINT');
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // List active sessions
  app.get("/api/terminal/sessions", (_req, res) => {
    const list = Array.from(terminalSessions.entries())
      .filter(([, s]) => !s.done)
      .map(([id, s]) => ({
        sessionId: id,
        command: s.command,
        startTime: s.startTime,
        cwd: s.cwd,
      }));
    res.json(list);
  });

  // System-level listening ports (shows externally-started processes like Vite)
  // Developer process names to include — everything else is filtered out
  const DEV_PROCESS_NAMES = new Set([
    "node", "node.exe",
    "npm", "npm.cmd", "npx", "npx.cmd",
    "bun", "bun.exe",
    "deno", "deno.exe",
    "python", "python3", "python.exe", "python3.exe",
    "ruby", "ruby.exe",
    "java", "java.exe",
    "php", "php.exe",
    "go", "go.exe",
    "cargo", "cargo.exe",
    "rustup", "rustup.exe",
    "vite", "webpack", "webpack-dev-server",
    "ts-node", "tsx",
  ]);

  app.get("/api/system/ports", async (_req, res) => {
    try {
      const isWin = process.platform === "win32";
      const ports: { pid: number; port: number; name: string }[] = [];

      if (isWin) {
        // netstat gives us port→PID mapping
        const { stdout: netOut } = await execPromise("netstat -ano -p TCP");
        const pidPorts = new Map<number, number[]>();
        for (const line of netOut.split(/\r?\n/)) {
          const m = line.match(/TCP\s+[\d.]+:(\d+)\s+[\d.]+:\d+\s+LISTENING\s+(\d+)/i);
          if (m) {
            const port = parseInt(m[1]);
            const pid = parseInt(m[2]);
            if (pid === 0) continue;
            if (!pidPorts.has(pid)) pidPorts.set(pid, []);
            pidPorts.get(pid)!.push(port);
          }
        }
        if (pidPorts.size > 0) {
          // tasklist gives us PID→name
          const { stdout: taskOut } = await execPromise("tasklist /FO CSV /NH");
          for (const line of taskOut.split(/\r?\n/)) {
            const parts = line.split(",").map(p => p.replace(/^"|"$/g, "").trim());
            if (parts.length < 2) continue;
            const name = parts[0];
            const pid = parseInt(parts[1]);
            if (!pidPorts.has(pid)) continue;
            // Only include developer process names
            if (!DEV_PROCESS_NAMES.has(name.toLowerCase())) continue;
            for (const port of pidPorts.get(pid)!) {
              ports.push({ pid, port, name });
            }
          }
        }
      } else {
        // Linux / macOS
        const { stdout } = await execPromise(
          "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null"
        ).catch(() => ({ stdout: "" }));
        for (const line of stdout.split(/\r?\n/)) {
          const mPort = line.match(/:(\d+)\s/);
          const mPid = line.match(/pid=(\d+)/);
          const mName = line.match(/\("([^"]+)"/);
          if (mPort && mPid) {
            const name = mName?.[1] ?? "process";
            if (!DEV_PROCESS_NAMES.has(name.toLowerCase())) continue;
            ports.push({ pid: parseInt(mPid[1]), port: parseInt(mPort[1]), name });
          }
        }
      }

      res.json(ports.sort((a, b) => a.port - b.port));
    } catch {
      res.json([]);
    }
  });

  // Kill a process by PID (system-level)
  app.post("/api/system/kill/:pid", async (req, res) => {
    const pid = parseInt(req.params.pid);
    if (isNaN(pid) || pid <= 1) return res.status(400).json({ error: "Invalid PID" });
    try {
      if (process.platform === "win32") {
        await execPromise(`taskkill /PID ${pid} /F`);
      } else {
        process.kill(pid, "SIGTERM");
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/git/branch", async (req, res) => {
    try {
      const { stdout } = await execPromise("git rev-parse --abbrev-ref HEAD", { cwd: projectRoot });
      res.json({ branch: stdout.trim() });
    } catch (error) {
      res.json({ branch: "unknown" });
    }
  });

  app.post("/api/git/fetch", async (req, res) => {
    try {
      const { stdout } = await execPromise("git fetch", { cwd: projectRoot });
      res.json({ success: true, stdout });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/git/status", async (req, res) => {
    try {
      const { stdout } = await execPromise("git status --porcelain", { cwd: projectRoot });
      const files = stdout.split("\n").filter(line => line.trim()).map(line => {
        const status = line.substring(0, 2).trim();
        const path = line.substring(3).trim();
        return { path, status };
      });
      res.json(files);
    } catch (error) {
       // If not a git repo, return empty but success
      res.json([]);
    }
  });

  app.post("/api/git/add", async (req, res) => {
    const { filePath } = req.body;
    try {
      // Use child_process.spawn-like approach or sanitize
      // For simplicity here, we'll use regex validation or escape
      if (/[;&|]/.test(filePath)) {
        return res.status(400).json({ error: "Invalid file path characters" });
      }
      await execPromise(`git add -- "${filePath}"`, { cwd: projectRoot });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/git/reset", async (req, res) => {
    const { filePath } = req.body;
    try {
      if (/[;&|]/.test(filePath)) {
        return res.status(400).json({ error: "Invalid file path characters" });
      }
      await execPromise(`git reset -- "${filePath}"`, { cwd: projectRoot });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/git/commit", async (req, res) => {
    const { message } = req.body;
    try {
      // Escape single quotes for shell
      const escapedMessage = message.replace(/'/g, "'\\''");
      const { stdout } = await execPromise(`git commit -m '${escapedMessage}'`, { cwd: projectRoot });
      res.json({ success: true, stdout });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/git/log", async (req, res) => {
    try {
      const { stdout } = await execPromise('git log -n 20 --pretty=format:"%H|%an|%ar|%s"', { cwd: projectRoot });
      const commits = stdout.split("\n").filter(line => line.trim()).map(line => {
        const [hash, author, date, message] = line.split("|");
        return {
          id: hash,
          hash: hash.substring(0, 7),
          author,
          date,
          message,
          color: "#3b82f6", // Default color
          active: false
        };
      });
      res.json(commits);
    } catch (error) {
      res.json([]);
    }
  });

  app.post("/api/git/clone", async (req, res) => {
    const { cloneUrl, targetPath } = req.body;
    try {
      // Validate path
      const absolutePath = path.resolve(projectRoot, targetPath);
      if (!absolutePath.startsWith(projectRoot)) {
        return res.status(403).json({ error: "Access denied: Target path must be within project root" });
      }

      // Check if directory exists and is empty
      try {
        const stats = await fs.stat(absolutePath);
        if (stats.isDirectory()) {
          const files = await fs.readdir(absolutePath);
          if (files.length > 0) {
            return res.status(400).json({ error: "Target directory is not empty" });
          }
        }
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          await fs.mkdir(absolutePath, { recursive: true });
        } else {
          throw e;
        }
      }

      const { stdout, stderr } = await execPromise(`git clone ${cloneUrl} .`, { cwd: absolutePath });
      res.json({ success: true, message: "Repository cloned successfully", stdout, stderr });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const CREDENTIALS_FILE = path.join(projectRoot, 'git_credentials.json');

  app.get("/api/git/credentials", async (req, res) => {
    try {
      const data = await fs.readFile(CREDENTIALS_FILE, "utf-8");
      res.json(JSON.parse(data));
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        res.json({});
      } else {
        res.status(500).json({ error: e.message });
      }
    }
  });

  app.post("/api/git/credentials", async (req, res) => {
    const { provider, token, username } = req.body;
    try {
      let existing: any = {};
      try {
        const data = await fs.readFile(CREDENTIALS_FILE, "utf-8");
        existing = JSON.parse(data);
      } catch (e) {}
      
      const updated = {
        ...existing,
        [provider]: { token, username }
      };
      
      await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(updated, null, 2), "utf-8");
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const EXTENSIONS_FILE = path.join(projectRoot, 'extensions.json');

  app.get("/api/extensions", async (req, res) => {
    try {
      const data = await fs.readFile(EXTENSIONS_FILE, "utf-8");
      res.json(JSON.parse(data));
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        res.json([]);
      } else {
        res.status(500).json({ error: e.message });
      }
    }
  });

  app.post("/api/extensions/install", async (req, res) => {
    const extension = req.body;
    try {
      let existing: any[] = [];
      try {
        const data = await fs.readFile(EXTENSIONS_FILE, "utf-8");
        existing = JSON.parse(data);
      } catch (e) {}
      
      if (!existing.some(e => e.id === extension.id)) {
        existing.push({ ...extension, installed: true, enabled: true });
      }
      
      await fs.writeFile(EXTENSIONS_FILE, JSON.stringify(existing, null, 2), "utf-8");
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/extensions/uninstall", async (req, res) => {
    const { id } = req.body;
    try {
      let existing: any[] = [];
      try {
        const data = await fs.readFile(EXTENSIONS_FILE, "utf-8");
        existing = JSON.parse(data);
      } catch (e) {}
      
      const filtered = existing.filter(e => e.id !== id);
      await fs.writeFile(EXTENSIONS_FILE, JSON.stringify(filtered, null, 2), "utf-8");
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/extensions/toggle", async (req, res) => {
    const { id, enabled } = req.body;
    try {
      let existing: any[] = [];
      try {
        const data = await fs.readFile(EXTENSIONS_FILE, "utf-8");
        existing = JSON.parse(data);
      } catch (e) {}
      
      const updated = existing.map(e => e.id === id ? { ...e, enabled } : e);
      await fs.writeFile(EXTENSIONS_FILE, JSON.stringify(updated, null, 2), "utf-8");
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const PACKAGE_JSON = path.join(projectRoot, 'package.json');

  app.get("/api/dependencies", async (req, res) => {
    try {
      const data = await fs.readFile(PACKAGE_JSON, "utf-8");
      res.json(JSON.parse(data));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/dependencies/install", async (req, res) => {
    const { name } = req.body;
    try {
      // In this environment, we can use the terminal logic to run npm install
      const { stdout, stderr } = await execPromise(`npm install ${name}`);
      res.json({ success: true, stdout, stderr });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/dependencies/uninstall", async (req, res) => {
    const { name } = req.body;
    try {
      const { stdout, stderr } = await execPromise(`npm uninstall ${name}`);
      res.json({ success: true, stdout, stderr });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // MCP Simulation API
  app.get("/api/mcp/tools", async (req, res) => {
    // Mocking an MCP server providing database tools
    res.json([
      {
        name: "query_database",
        description: "Execute a SQL query against the connected database.",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string", description: "The SQL query to run." },
            connectionId: { type: "string", description: "The database connection ID." }
          },
          required: ["sql", "connectionId"]
        }
      },
      {
        name: "list_tables",
        description: "List all tables in the database schema.",
        inputSchema: {
          type: "object",
          properties: {
            connectionId: { type: "string", description: "The database connection ID." }
          },
          required: ["connectionId"]
        }
      }
    ]);
  });

  app.post("/api/mcp/call", async (req, res) => {
    const { toolName, args } = req.body;
    // Simulate tool execution
    if (toolName === "query_database") {
      res.json({
        content: [
          { type: "text", text: `Executed query: ${args.sql}\nResult: 14 rows affected.` }
        ]
      });
    } else if (toolName === "list_tables") {
      res.json({
        content: [
          { type: "text", text: "Tables: users, orders, products, audit_log, schema_migrations" }
        ]
      });
    } else {
      res.status(404).json({ error: "Tool not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // DIST_PATH env var is set by electron/main.ts with the absolute path to dist/.
    // Fallback: __dirname = dist-server/ (from process.argv[1]), so .. = app root.
    const distPath = process.env.DIST_PATH || path.resolve(__dirname, "..", "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // JSON 404 fallback — catches any unmatched route after Vite/static middleware
  app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.url}` });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
