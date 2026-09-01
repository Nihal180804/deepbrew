import { ipcMain, dialog, clipboard, nativeImage, app, BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IPC, type TimerCommand } from '@shared/ipc-contract.js';
import type { PlatformInfo, Settings } from '@shared/types.js';
import { loadSettings, updateSettings } from './db/settings-store.js';
import {
  getStatsSummary,
  getRecentSessions,
  getPersonaData,
  exportAllData,
  deleteAllData
} from './db/analytics-store.js';
import { isActiveWindowSupported } from './active-window.js';
import type { TimerController } from './timer-controller.js';

export interface IpcContext {
  controller: TimerController;
  onSettingsApplied: (settings: Settings) => void;
  openDashboard: (tab?: string) => void;
  onStatsChanged: () => void;
  togglePin: () => boolean;
  isPinned: () => boolean;
  movePinBy: (dx: number, dy: number) => void;
  snapPin: () => void;
}

export function registerIpc(ctx: IpcContext): void {
  ipcMain.handle(IPC.timerGet, () => ctx.controller.getSnapshot());

  ipcMain.handle(IPC.timerCommand, (_e, cmd: TimerCommand) => {
    applyCommand(ctx.controller, cmd);
    return ctx.controller.getSnapshot();
  });

  ipcMain.handle(IPC.settingsGet, () => loadSettings());

  ipcMain.handle(IPC.settingsUpdate, (_e, patch: Partial<Settings>) => {
    const next = updateSettings(patch);
    ctx.controller.applySettings(next);
    ctx.onSettingsApplied(next);
    return next;
  });

  ipcMain.handle(IPC.statsGet, (_e, days?: number) => getStatsSummary(days ?? 30));
  ipcMain.handle(IPC.sessionsGet, (_e, limit?: number) => getRecentSessions(limit ?? 100));
  ipcMain.handle(IPC.personaGet, (_e, range: 'today' | 'week') => getPersonaData(range));

  ipcMain.handle(IPC.dataExport, async () => {
    const data = exportAllData();
    const payload = {
      app: 'deepbrew',
      version: app.getVersion(),
      exportedAt: new Date().toISOString(),
      settings: loadSettings(),
      ...data
    };
    const defaultPath = join(
      app.getPath('downloads'),
      `deepbrew-export-${new Date().toISOString().slice(0, 10)}.json`
    );
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Deepbrew data',
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePath) return { ok: false };
    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return { ok: true, path: filePath };
  });

  ipcMain.handle(IPC.dataDelete, () => {
    deleteAllData();
    ctx.onStatsChanged();
    return { ok: true };
  });

  ipcMain.handle(IPC.platformGet, async (): Promise<PlatformInfo> => {
    const { supported, note } = await isActiveWindowSupported();
    return {
      platform: process.platform,
      activeWindowSupported: supported,
      activeWindowNote: note,
      appVersion: app.getVersion()
    };
  });

  ipcMain.handle(IPC.openDashboard, (_e, tab?: string) => {
    ctx.openDashboard(tab);
  });

  ipcMain.handle(IPC.winMinimize, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize();
  });

  ipcMain.handle(IPC.winMaximizeToggle, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });

  ipcMain.handle(IPC.winClose, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  });

  ipcMain.handle(IPC.winIsMaximized, (e) => {
    return BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false;
  });

  ipcMain.handle(IPC.pinToggle, () => ctx.togglePin());
  ipcMain.handle(IPC.pinIsActive, () => ctx.isPinned());
  ipcMain.on(IPC.pinMoveBy, (_e, dx: number, dy: number) => ctx.movePinBy(dx, dy));
  ipcMain.on(IPC.pinSnap, () => ctx.snapPin());

  ipcMain.handle(IPC.clipboardWriteImage, (_e, dataUrl: string) => {
    try {
      const image = nativeImage.createFromDataURL(dataUrl);
      clipboard.writeImage(image);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle(IPC.savePng, async (e, dataUrl: string, suggestedName: string) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const defaultPath = join(app.getPath('pictures'), suggestedName);
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: 'Save focus card',
      defaultPath,
      filters: [{ name: 'PNG image', extensions: ['png'] }]
    });
    if (canceled || !filePath) return { ok: false };
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    await writeFile(filePath, Buffer.from(base64, 'base64'));
    return { ok: true, path: filePath };
  });
}

function applyCommand(controller: TimerController, cmd: TimerCommand): void {
  switch (cmd.type) {
    case 'start':
      controller.start(cmd.phase);
      break;
    case 'pause':
      controller.pause();
      break;
    case 'resume':
      controller.resume();
      break;
    case 'toggle':
      controller.toggle();
      break;
    case 'reset':
      controller.reset();
      break;
    case 'stop':
      controller.stop();
      break;
    case 'skip':
      controller.skip();
      break;
    case 'extend':
      controller.extend(cmd.minutes);
      break;
  }
}
