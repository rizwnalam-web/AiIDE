import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/files", async (req, res) => {
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
              path: path.relative(process.cwd(), filePath),
              children: await walk(filePath),
            });
          } else {
            result.push({
              name: file,
              type: "file",
              path: path.relative(process.cwd(), filePath),
            });
          }
        }
        return result;
      };
      const fileTree = await walk(process.cwd());
      res.json(fileTree);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/read-file", async (req, res) => {
    const { filePath } = req.body;
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      if (!absolutePath.startsWith(process.cwd())) {
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
      const absolutePath = path.resolve(process.cwd(), filePath);
      if (!absolutePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: "Access denied" });
      }
      await fs.writeFile(absolutePath, content, "utf-8");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/terminal", async (req, res) => {
    const { command } = req.body;
    try {
      const { stdout, stderr } = await execPromise(command, { cwd: process.cwd() });
      res.json({ stdout, stderr });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/git/clone", async (req, res) => {
    const { cloneUrl, targetPath } = req.body;
    try {
      // Validate path
      const absolutePath = path.resolve(process.cwd(), targetPath);
      if (!absolutePath.startsWith(process.cwd())) {
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
