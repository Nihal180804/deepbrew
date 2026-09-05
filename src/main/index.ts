import { app, nativeTheme } from 'electron';
import { join } from 'node:path';
import { IPC } from '@shared/ipc-contract.js';
import type { Settings, TimerSnapshot } from '@shared/types.js';
import { getDb, closeDb } from './db/database.js';
import { loadSettings } from './db/settings-store.js';
import { TimerController } from './timer-controller.js';
import { createTray, updateTray, destroyTray, setTrayPinned } from './tray.js';
import {
  togglePopover,
  hidePopover,
  openDashboard,
  broadcast,
  togglePin,
  isPinned,
  movePinBy,
  snapPin,
  resizePinTo
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

// Safety net: never let a recoverable error (e.g. a native window call
// rejecting an odd coordinate mid-drag) crash the whole app with Electron's
// fatal "A JavaScript error occurred in the main process" dialog. Log and
// carry on; genuine fatal errors still surface in dev via the console.
process.on('uncaughtException', (err) => {
  console.error('[main] uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandled rejection:', reason);
});

// Single-instance: a second launch just focuses/open the popover.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => togglePopover());
  // GPU acceleration can only be turned off before the app is ready. When the
  // user opts into low-memory mode, drop the GPU process (~40-60MB); the simple
  // 2D UI renders fine in software.
  try {
    if (loadSettings().reduceMemory) app.disableHardwareAcceleration();
  } catch {
    /* first run / DB not ready — keep acceleration on */
  }
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
      // The pin window resizes itself: the renderer measures the card after the
      // new size preset renders and reports it via IPC.pinResize.
      broadcast(IPC.settingsChanged, next);
    },
    openDashboard: (tab?: string) => openDashboard(tab),
    onStatsChanged: () => broadcast(IPC.statsInvalidated, null),
    togglePin: () => {
      const pinned = togglePin();
      setTrayPinned(pinned);
      return pinned;
    },
    isPinned: () => isPinned(),
    movePinBy: (dx, dy) => movePinBy(dx, dy),
    snapPin: () => snapPin(),
    resizePinTo: (w, h) => resizePinTo(w, h)
  });

  applyShortcuts(settings);
  maybeSendAppOpenPing(app.getVersion());

  // Push an initial snapshot so tray + any open window render immediately.
  updateTray(controller.getSnapshot());

  // Optional launch behaviors.
  if (settings.openPinOnLaunch && !isPinned()) {
    togglePin();
    setTrayPinned(true);
  }
  if (settings.autoStartFocusOnLaunch) {
    controller.start();
  }

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
