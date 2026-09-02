import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type KofeApi, type TimerCommand } from '@shared/ipc-contract.js';
import type { Settings, TimerSnapshot } from '@shared/types.js';

/**
 * The single, typed bridge exposed to renderers as `window.kofe`. Renderers
 * have no direct Node/Electron access (contextIsolation on); everything goes
 * through these vetted channels.
 */

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: KofeApi = {
  getTimer: () => ipcRenderer.invoke(IPC.timerGet),
  sendCommand: (cmd: TimerCommand) => ipcRenderer.invoke(IPC.timerCommand, cmd),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch),
  getStats: (days) => ipcRenderer.invoke(IPC.statsGet, days),
  getSessions: (limit) => ipcRenderer.invoke(IPC.sessionsGet, limit),
  getPersona: (range) => ipcRenderer.invoke(IPC.personaGet, range),
  exportData: () => ipcRenderer.invoke(IPC.dataExport),
  deleteAllData: () => ipcRenderer.invoke(IPC.dataDelete),
  getPlatform: () => ipcRenderer.invoke(IPC.platformGet),
  openDashboard: (tab) => ipcRenderer.invoke(IPC.openDashboard, tab),
  minimizeWindow: () => ipcRenderer.invoke(IPC.winMinimize),
  toggleMaximizeWindow: () => ipcRenderer.invoke(IPC.winMaximizeToggle),
  closeWindow: () => ipcRenderer.invoke(IPC.winClose),
  isWindowMaximized: () => ipcRenderer.invoke(IPC.winIsMaximized),
  togglePin: () => ipcRenderer.invoke(IPC.pinToggle),
  isPinned: () => ipcRenderer.invoke(IPC.pinIsActive),
  pinMoveBy: (dx: number, dy: number) => ipcRenderer.send(IPC.pinMoveBy, dx, dy),
  pinSnap: () => ipcRenderer.send(IPC.pinSnap),
  pinResize: (w: number, h: number) => ipcRenderer.send(IPC.pinResize, w, h),
  copyImageToClipboard: (dataUrl) => ipcRenderer.invoke(IPC.clipboardWriteImage, dataUrl),
  savePng: (dataUrl, name) => ipcRenderer.invoke(IPC.savePng, dataUrl, name),

  onTimerUpdate: (cb: (s: TimerSnapshot) => void) => subscribe(IPC.timerUpdate, cb),
  onSettingsChanged: (cb: (s: Settings) => void) => subscribe(IPC.settingsChanged, cb),
  onStatsInvalidated: (cb: () => void) => subscribe(IPC.statsInvalidated, () => cb())
};

contextBridge.exposeInMainWorld('kofe', api);
