import { Notification } from 'electron';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { loadSettings } from './db/settings-store.js';

/**
 * Native OS notifications (Windows toast / Linux libnotify via Electron).
 * Sound is played by the renderer where possible; here we only fire the
 * system notification and respect the user's notification toggle.
 */

let iconPath: string | undefined;

export function setNotificationIcon(path: string): void {
  if (existsSync(path)) iconPath = path;
}

export interface NudgeOptions {
  title: string;
  body: string;
  silent?: boolean;
}

export function notify(opts: NudgeOptions): void {
  const settings = loadSettings();
  if (!settings.notificationsEnabled) return;
  if (!Notification.isSupported()) return;

  const n = new Notification({
    title: opts.title,
    body: opts.body,
    silent: opts.silent ?? !settings.soundEnabled,
    icon: iconPath
  });
  n.show();
}

export function resolveIcon(resourcesRoot: string): string {
  return join(resourcesRoot, 'icon.png');
}
