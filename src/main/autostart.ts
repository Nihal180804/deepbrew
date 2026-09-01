import { app } from 'electron';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';

/**
 * Autostart-on-login, per platform:
 *  - Windows: Electron's app.setLoginItemSettings (writes the Run registry key).
 *  - Linux:   an XDG autostart .desktop file in ~/.config/autostart.
 *
 * macOS would also use setLoginItemSettings, but this app targets Win/Linux.
 */

const LINUX_AUTOSTART_FILE = join(
  homedir(),
  '.config',
  'autostart',
  'deepbrew.desktop'
);

function linuxDesktopEntry(): string {
  // In production the launcher is the packaged executable; in dev it's electron.
  const exec = app.isPackaged ? process.execPath : `${process.execPath} ${app.getAppPath()}`;
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Deepbrew',
    'Comment=Minimalist focus-session timer',
    `Exec=${exec} --hidden`,
    'X-GNOME-Autostart-enabled=true',
    'Terminal=false',
    'Categories=Utility;'
  ].join('\n');
}

export function setAutostart(enabled: boolean): void {
  if (process.platform === 'linux') {
    const dir = join(homedir(), '.config', 'autostart');
    if (enabled) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(LINUX_AUTOSTART_FILE, linuxDesktopEntry(), 'utf8');
    } else if (existsSync(LINUX_AUTOSTART_FILE)) {
      rmSync(LINUX_AUTOSTART_FILE);
    }
    return;
  }

  // Windows (and macOS): built-in login-item API.
  app.setLoginItemSettings({
    openAtLogin: enabled,
    args: ['--hidden']
  });
}

export function getAutostart(): boolean {
  if (process.platform === 'linux') {
    return existsSync(LINUX_AUTOSTART_FILE);
  }
  return app.getLoginItemSettings().openAtLogin;
}
