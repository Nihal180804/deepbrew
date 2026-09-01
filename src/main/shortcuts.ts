import { globalShortcut } from 'electron';
import type { Settings } from '@shared/types.js';

/**
 * Global keyboard shortcuts. Registration is best-effort: if an accelerator is
 * already taken by the OS or another app, we skip it and report the failure so
 * Settings can warn the user, rather than crashing.
 */

export interface ShortcutHandlers {
  onStartPause: () => void;
  onReset: () => void;
  onOpenDashboard: () => void;
}

export interface ShortcutResult {
  registered: string[];
  failed: string[];
}

export function registerShortcuts(
  settings: Settings,
  handlers: ShortcutHandlers
): ShortcutResult {
  unregisterShortcuts();
  const registered: string[] = [];
  const failed: string[] = [];

  const tryRegister = (accel: string, fn: () => void) => {
    if (!accel) return;
    try {
      const ok = globalShortcut.register(accel, fn);
      (ok ? registered : failed).push(accel);
    } catch {
      failed.push(accel);
    }
  };

  tryRegister(settings.shortcuts.startPause, handlers.onStartPause);
  tryRegister(settings.shortcuts.reset, handlers.onReset);
  tryRegister(settings.shortcuts.openDashboard, handlers.onOpenDashboard);

  return { registered, failed };
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
}
