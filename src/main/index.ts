import { app, nativeTheme } from 'electron';
import { join } from 'node:path';
import { IPC } from '@shared/ipc-contract.js';
import type { Settings, TimerSnapshot } from '@shared/types.js';
import { getDb, closeDb } from './db/database.js';
import { loadSettings } from './db/settings-store.js';
import { TimerController } from './timer-controller.js';
import { createTray, updateTray, destroyTray, setTrayPinned } from './tray.js';
import {
  createPopover,
  togglePopover,
  hidePopover,
  openDashboard,
  broadcast,
  togglePin,
  isPinned
} from './windows.js';
import { registerIpc } from './ipc.js';
import { registerShortcuts, unregisterShortcuts } from './shortcuts.js';
import { setAutostart, getAutostart } from './autostart.js';
import { notify, setNotificationIcon, resolveIcon } from './notifications.js';
import { maybeSendAppOpenPing } from './product-analytics.js';

/**
 * App entry point. Deepbrew is a tray-first app: it has no primary window and
 * never shows in the taskbar/dock by default. Quitting is explicit (tray menu
 * or dashboard), so closing the dashboard window does not exit the app.
 */

let controller: TimerController;
let isQuitting = false;

// Single-instance: a second launch just focuses/open the popover.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => togglePopover());
  void main();
}

async function main(): Promise<void> {
  await app.whenReady();

  // Keep the app alive with no windows open (tray-only). Subscribing to this
  // event and NOT quitting overrides Electron's default quit-on-last-window.
  app.on('window-all-closed', () => {
    if (isQuitting) app.quit();
  });

  const resourcesRoot = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources');
  setNotificationIcon(resolveIcon(resourcesRoot));

  getDb(); // open + migrate
  const settings = loadSettings();
  applyTheme(settings);
  syncAutostart(settings);

  controller = new TimerController({
    getSettings: loadSettings,
    onSnapshot: (snapshot: TimerSnapshot) => {
      updateTray(snapshot);
      broadcast(IPC.timerUpdate, snapshot);
    },
    onStatsChanged: () => broadcast(IPC.statsInvalidated, null),
    notify: (opts) => notify(opts)
  });

  // Pre-create the popover so the first tray click is instant.
  createPopover();

  createTray({
    onToggle: () => controller.toggle(),
    onStart: () => controller.start(),
    onPause: () => controller.pause(),
    onResume: () => controller.resume(),
    onExtend: () => controller.extend(5),
    onReset: () => controller.reset(),
    onStop: () => controller.stop(),
    onOpenPopover: (bounds) => togglePopover(bounds),
    onOpenDashboard: () => {
      hidePopover();
      openDashboard();
    },
    onTogglePin: () => {
      const pinned = togglePin();
      setTrayPinned(pinned);
    },
    onQuit: () => quit()
  });

  registerIpc({
    controller,
    onSettingsApplied: (next: Settings) => {
      applyTheme(next);
      syncAutostart(next);
      applyShortcuts(next);
      broadcast(IPC.settingsChanged, next);
    },
    openDashboard: (tab?: string) => openDashboard(tab),
    onStatsChanged: () => broadcast(IPC.statsInvalidated, null),
    togglePin: () => {
      const pinned = togglePin();
      setTrayPinned(pinned);
      return pinned;
    },
    isPinned: () => isPinned()
  });

  applyShortcuts(settings);
  maybeSendAppOpenPing(app.getVersion());

  // Push an initial snapshot so tray + any open window render immediately.
  updateTray(controller.getSnapshot());

  app.on('before-quit', () => {
    isQuitting = true;
  });
}

function applyShortcuts(settings: Settings): void {
  registerShortcuts(settings, {
    onStartPause: () => controller.toggle(),
    onReset: () => controller.reset(),
    onOpenDashboard: () => openDashboard()
  });
}

function applyTheme(settings: Settings): void {
  nativeTheme.themeSource = settings.theme;
}

function syncAutostart(settings: Settings): void {
  // Reconcile the persisted preference with the OS state.
  if (getAutostart() !== settings.autostart) {
    setAutostart(settings.autostart);
  }
}

function quit(): void {
  isQuitting = true;
  unregisterShortcuts();
  controller?.dispose();
  destroyTray();
  closeDb();
  app.quit();
}
