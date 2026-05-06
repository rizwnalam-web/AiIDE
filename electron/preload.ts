import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose a small, controlled surface to the renderer process.
 * All Electron/Node APIs that the React app may need must be
 * explicitly whitelisted here — never set nodeIntegration: true.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,

  /** Open a native folder-picker dialog and return the chosen path (or null). */
  openFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:open-folder'),

  /** Listen to menu-driven navigation events from the main process. */
  onGoToView: (cb: (view: string) => void) =>
    ipcRenderer.on('menu:go', (_e, view) => cb(view)),

  /** Listen for a folder path sent by the File → Open Folder menu item. */
  onOpenFolder: (cb: (folderPath: string) => void) =>
    ipcRenderer.on('menu:open-folder', (_e, folderPath) => cb(folderPath)),

  /** Listen for File → Save As path. */
  onSaveAs: (cb: (filePath: string) => void) =>
    ipcRenderer.on('menu:save-as', (_e, filePath) => cb(filePath)),

  /** Listen for File → Auto Save toggle. */
  onAutoSave: (cb: (enabled: boolean) => void) =>
    ipcRenderer.on('menu:auto-save', (_e, enabled) => cb(enabled)),

  /** Listen for File → Close Folder. */
  onCloseFolder: (cb: () => void) =>
    ipcRenderer.on('menu:close-folder', () => cb()),

  /** Listen for File → Clear Recently Opened. */
  onClearRecent: (cb: () => void) =>
    ipcRenderer.on('menu:clear-recent', () => cb()),

  /** Clean up listeners (call on component unmount). */
  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),
});
