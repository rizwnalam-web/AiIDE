import { app, BrowserWindow, shell, Menu, MenuItem, dialog, ipcMain } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';

/** Read GEMINI_API_KEY from a .env file next to the executable (for packaged builds). */
function loadEnvKey(): string {
  try {
    // Look next to the installed exe: <install dir>/.env
    const envPath = path.join(path.dirname(process.execPath), '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^GEMINI_API_KEY\s*=\s*(.+)$/);
        if (m) return m[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {}
  return process.env.GEMINI_API_KEY ?? '';
}

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

/** Poll until the local server responds or the timeout elapses. */
function waitForServer(timeout = 20_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    const attempt = () => {
      const req = http.get(`http://localhost:${PORT}/`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Server did not become ready within ${timeout}ms`));
        } else {
          setTimeout(attempt, 500);
        }
      });
      req.end();
    };
    attempt();
  });
}

/** Spawn the Express server as a child process. */
function launchServer(): void {
  const isDev = !app.isPackaged;

  // Root of the project (dev) or the packaged resources/app directory (prod)
  const projectRoot = isDev
    ? path.resolve(__dirname, '..')
    : path.join(process.resourcesPath, 'app');

  let cmd: string;
  let args: string[];
  let env: NodeJS.ProcessEnv;

  let spawnOpts: import('child_process').SpawnOptions;

  if (isDev) {
    // On Windows, .cmd files must be executed via the shell.
    // Use `cmd /c tsx server.ts` to avoid EINVAL spawn errors.
    const isWin = process.platform === 'win32';
    if (isWin) {
      const tsxCmd = path.join(projectRoot, 'node_modules', '.bin', 'tsx.cmd');
      cmd = 'cmd';
      args = ['/c', tsxCmd, path.join(projectRoot, 'server.ts')];
    } else {
      cmd = path.join(projectRoot, 'node_modules', '.bin', 'tsx');
      args = [path.join(projectRoot, 'server.ts')];
    }
    env = { ...process.env, NODE_ENV: 'development' };
    spawnOpts = { env, cwd: projectRoot };
  } else {
    // Production: run the pre-bundled server with Electron's own Node runtime.
    // ELECTRON_RUN_AS_NODE=1 makes the Electron binary behave as plain Node.js.
    // process.resourcesPath = <install>\resources  (ASAR disabled, so files sit there directly)
    const serverEntry = path.join(process.resourcesPath, 'app', 'dist-server', 'server.js');
    cmd = process.execPath;
    args = [serverEntry];
    env = {
      ...process.env,
      NODE_ENV: 'production',
      ELECTRON_RUN_AS_NODE: '1',
      GEMINI_API_KEY: loadEnvKey(),
      // Explicit paths so server.ts never has to guess via __dirname
      DIST_PATH: path.join(process.resourcesPath, 'app', 'dist'),
      PORTABLE_EXECUTABLE_DIR: path.join(process.resourcesPath, 'app'),
    };
    spawnOpts = { env, cwd: path.join(process.resourcesPath, 'app') };
  }

  serverProcess = spawn(cmd, args, spawnOpts);

  serverProcess.stdout?.on('data', (d: Buffer) =>
    console.log('[server]', d.toString().trimEnd())
  );
  serverProcess.stderr?.on('data', (d: Buffer) =>
    console.error('[server]', d.toString().trimEnd())
  );
  serverProcess.on('error', (err) =>
    console.error('[server] spawn error:', err.message)
  );
}

function buildMenu(win: BrowserWindow): Menu {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // File
    {
      label: 'File',
      submenu: [
        {
          label: 'New Text File',
          accelerator: 'CmdOrCtrl+N',
          click: () => win.webContents.executeJavaScript("window.__nexus?.newFile?.()"),
        },
        { type: 'separator' },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog(win, {
              properties: ['openFile'],
              title: 'Open File',
            });
            if (!canceled && filePaths[0]) {
              win.webContents.send('menu:open-file', filePaths[0]);
            }
          },
        },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog(win, {
              properties: ['openDirectory'],
              title: 'Open Project Folder',
            });
            if (!canceled && filePaths[0]) {
              win.webContents.send('menu:open-folder', filePaths[0]);
            }
          },
        },
        {
          label: 'Open Recent',
          role: 'recentDocuments' as any,
          submenu: [
            {
              label: 'Clear Recently Opened',
              click: () => win.webContents.send('menu:clear-recent'),
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => win.webContents.executeJavaScript("window.__nexus?.save?.()"),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async () => {
            const { canceled, filePath } = await dialog.showSaveDialog(win, {
              title: 'Save File As',
            });
            if (!canceled && filePath) {
              win.webContents.send('menu:save-as', filePath);
            }
          },
        },
        {
          label: 'Save All',
          accelerator: 'CmdOrCtrl+K S',
          click: () => win.webContents.executeJavaScript("window.__nexus?.saveAll?.()"),
        },
        { type: 'separator' },
        {
          label: 'Auto Save',
          type: 'checkbox' as const,
          checked: false,
          click: (item) => win.webContents.send('menu:auto-save', item.checked),
        },
        {
          label: 'Preferences',
          submenu: [
            {
              label: 'Settings',
              accelerator: 'CmdOrCtrl+,',
              click: () => win.webContents.send('menu:go', 'settings'),
            },
            {
              label: 'Keyboard Shortcuts',
              accelerator: 'CmdOrCtrl+K CmdOrCtrl+S',
              click: () => win.webContents.send('menu:go', 'shortcuts'),
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Revert File',
          click: () => win.webContents.executeJavaScript("window.__nexus?.revertFile?.()"),
        },
        {
          label: 'Close Editor',
          accelerator: 'CmdOrCtrl+W',
          click: () => win.webContents.executeJavaScript("window.__nexus?.closeEditor?.()"),
        },
        {
          label: 'Close Folder',
          accelerator: 'CmdOrCtrl+K F',
          click: () => win.webContents.send('menu:close-folder'),
        },
        {
          label: 'Close Window',
          accelerator: isMac ? 'Cmd+Shift+W' : 'Alt+F4',
          click: () => win.close(),
        },
        { type: 'separator' },
        isMac ? { role: 'quit' as const } : { role: 'quit' as const, label: 'Exit' },
      ],
    },
    // Edit
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => win.webContents.executeJavaScript("window.__nexus?.find?.()"),
        },
      ],
    },
    // Selection
    {
      label: 'Selection',
      submenu: [
        { role: 'selectAll' },
        {
          label: 'Expand Line Selection',
          accelerator: 'CmdOrCtrl+L',
          click: () => win.webContents.executeJavaScript("window.__nexus?.expandSelection?.()"),
        },
      ],
    },
    // View
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // Go
    {
      label: 'Go',
      submenu: [
        {
          label: 'Explorer',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => win.webContents.send('menu:go', 'files'),
        },
        {
          label: 'Search',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => win.webContents.send('menu:go', 'search'),
        },
        {
          label: 'Source Control',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => win.webContents.send('menu:go', 'git'),
        },
        {
          label: 'AI Chat',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => win.webContents.send('menu:go', 'chat'),
        },
        {
          label: 'Extensions',
          accelerator: 'CmdOrCtrl+Shift+X',
          click: () => win.webContents.send('menu:go', 'extensions'),
        },
      ],
    },
    // Run
    {
      label: 'Run',
      submenu: [
        {
          label: 'Start Debugging',
          accelerator: 'F5',
          click: () => win.webContents.send('menu:run', 'debug'),
        },
        {
          label: 'Run Without Debugging',
          accelerator: 'CmdOrCtrl+F5',
          click: () => win.webContents.send('menu:run', 'run'),
        },
      ],
    },
    // Terminal
    {
      label: 'Terminal',
      submenu: [
        {
          label: 'New Terminal',
          accelerator: 'CmdOrCtrl+`',
          click: () => win.webContents.send('menu:terminal', 'new'),
        },
        {
          label: 'Clear Terminal',
          click: () => win.webContents.send('menu:terminal', 'clear'),
        },
      ],
    },
    // Help
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://github.com/rizwnalam-web/AiIDE'),
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: () => win.webContents.toggleDevTools(),
        },
        { type: 'separator' },
        {
          label: 'About Nexus AI Editor',
          click: () =>
            dialog.showMessageBox(win, {
              title: 'Nexus AI Editor',
              message: 'Nexus AI Editor',
              detail: `Version ${app.getVersion()}\nEditing evolved`,
              type: 'info',
            }),
        },
      ],
    },
  ];

  if (isMac) {
    template.unshift({ role: 'appMenu' });
  }

  return Menu.buildFromTemplate(template);
}

/** IPC: open a native folder-picker and return the chosen path */
function registerIpc(): void {
  ipcMain.handle('dialog:open-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win ?? BrowserWindow.getFocusedWindow()!, {
      properties: ['openDirectory'],
      title: 'Open Project Folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    title: 'Nexus AI Editor',
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const menu = buildMenu(mainWindow);
  Menu.setApplicationMenu(menu);

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Only show the window once the page has fully loaded to avoid a white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Intercept navigation to external URLs and open them in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function killServer(): void {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.whenReady().then(async () => {
  registerIpc();
  launchServer();
  await waitForServer(30_000).catch((err) =>
    console.error('[main] Server wait failed:', err.message)
  );
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', killServer);
