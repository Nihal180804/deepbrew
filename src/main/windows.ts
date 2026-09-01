import { BrowserWindow, screen, app } from 'electron';
import { join } from 'node:path';

/**
 * Owns the two renderer windows:
 *  - popover: a small, frameless, borderless dropdown anchored near the tray,
 *    shown/hidden on tray click (never a taskbar window).
 *  - dashboard: a normal resizable window with stats, history, and settings.
 */

const preloadPath = join(__dirname, '../preload/index.js');

function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'resources', 'icon.png');
}

function rendererUrl(page: 'popover' | 'dashboard' | 'pin'): { url?: string; file?: string } {
  // In dev, electron-vite serves the renderer; in prod we load built files.
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) return { url: `${devUrl}/${page}.html` };
  return { file: join(__dirname, `../renderer/${page}.html`) };
}

let popover: BrowserWindow | null = null;
let dashboard: BrowserWindow | null = null;
let pinWin: BrowserWindow | null = null;
let pinBounds: { x: number; y: number } | null = null;

export function getPopover(): BrowserWindow | null {
  return popover;
}

export function createPopover(): BrowserWindow {
  if (popover && !popover.isDestroyed()) return popover;

  popover = new BrowserWindow({
    width: 340,
    height: 600,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // Transparent + frameless gives the rounded popover its shape. Works on
    // Windows and compositor-backed Linux desktops (GNOME/KDE/most X11 setups).
    transparent: true,
    hasShadow: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const target = rendererUrl('popover');
  if (target.url) void popover.loadURL(target.url);
  else void popover.loadFile(target.file!);

  // Hide (not close) when it loses focus, like a native menu-bar popover.
  popover.on('blur', () => {
    if (popover && !popover.webContents.isDevToolsOpened()) popover.hide();
  });

  popover.on('closed', () => {
    popover = null;
  });

  return popover;
}

/** Position the popover near the tray icon and show it. */
export function togglePopover(trayBounds?: Electron.Rectangle): void {
  const win = createPopover();
  if (win.isVisible()) {
    win.hide();
    return;
  }
  positionPopover(win, trayBounds);
  win.show();
  win.focus();
}

function positionPopover(win: BrowserWindow, trayBounds?: Electron.Rectangle): void {
  const { width, height } = win.getBounds();
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;

  let x: number;
  let y: number;

  if (trayBounds && trayBounds.width > 0) {
    x = Math.round(trayBounds.x + trayBounds.width / 2 - width / 2);
    // Tray at bottom (Windows) vs top: decide by tray y position.
    const trayAtTop = trayBounds.y < workArea.height / 2;
    y = trayAtTop ? Math.round(trayBounds.y + trayBounds.height + 4) : Math.round(trayBounds.y - height - 4);
  } else {
    // Fallback: bottom-right corner.
    x = workArea.x + workArea.width - width - 12;
    y = workArea.y + workArea.height - height - 12;
  }

  // Clamp within the work area.
  x = Math.max(workArea.x + 4, Math.min(x, workArea.x + workArea.width - width - 4));
  y = Math.max(workArea.y + 4, Math.min(y, workArea.y + workArea.height - height - 4));
  win.setBounds({ x, y, width, height });
}

export function hidePopover(): void {
  if (popover && !popover.isDestroyed()) popover.hide();
}

export function openDashboard(tab?: string): BrowserWindow {
  const hash = tab ? `#${tab}` : '';
  if (dashboard && !dashboard.isDestroyed()) {
    if (dashboard.isMinimized()) dashboard.restore();
    if (tab) {
      void dashboard.webContents.executeJavaScript(
        `window.location.hash = ${JSON.stringify(tab)};`
      );
    }
    dashboard.show();
    dashboard.focus();
    return dashboard;
  }

  dashboard = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    show: false,
    title: 'Deepbrew',
    icon: iconPath(),
    backgroundColor: '#f0efed',
    // Frameless: the renderer draws its own auto-hiding title bar (revealed by
    // pushing the cursor to the top edge, like a browser's fullscreen mode).
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const target = rendererUrl('dashboard');
  if (target.url) void dashboard.loadURL(target.url + hash);
  else void dashboard.loadFile(target.file!, { hash: tab });

  dashboard.once('ready-to-show', () => dashboard?.show());
  dashboard.on('closed', () => {
    dashboard = null;
  });

  return dashboard;
}

export function getDashboard(): BrowserWindow | null {
  return dashboard;
}

/** Broadcast a message to every live renderer. */
export function broadcast(channel: string, payload: unknown): void {
  for (const win of [popover, dashboard, pinWin]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

/* ---------------- Pinned floating mini-timer ---------------- */

export function isPinned(): boolean {
  return !!(pinWin && !pinWin.isDestroyed());
}

/** Toggle the always-on-top mini timer. Returns the new pinned state. */
export function togglePin(): boolean {
  if (isPinned()) {
    pinWin!.close();
    return false;
  }
  createPin();
  return true;
}

/** Move the pinned window by a pixel delta (used while dragging it). */
export function movePinBy(dx: number, dy: number): void {
  if (!pinWin || pinWin.isDestroyed()) return;
  const [x, y] = pinWin.getPosition();
  const nx = Math.round(x + dx);
  const ny = Math.round(y + dy);
  pinWin.setPosition(nx, ny);
  pinBounds = { x: nx, y: ny };
}

/** Snap the pinned window to the nearest corner of its display's work area. */
export function snapPin(): void {
  if (!pinWin || pinWin.isDestroyed()) return;
  const b = pinWin.getBounds();
  const { workArea } = screen.getDisplayMatching(b);
  const m = 16;
  const centerX = b.x + b.width / 2;
  const centerY = b.y + b.height / 2;
  const left = centerX < workArea.x + workArea.width / 2;
  const top = centerY < workArea.y + workArea.height / 2;
  const nx = left ? workArea.x + m : workArea.x + workArea.width - b.width - m;
  const ny = top ? workArea.y + m : workArea.y + workArea.height - b.height - m;
  pinWin.setPosition(nx, ny, true);
  pinBounds = { x: nx, y: ny };
}

function createPin(): void {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 208;
  const height = 78;
  pinWin = new BrowserWindow({
    width,
    height,
    x: pinBounds ? pinBounds.x : workArea.x + workArea.width - width - 16,
    y: pinBounds ? pinBounds.y : workArea.y + 16,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  // Float above normal windows (and most fullscreen apps).
  pinWin.setAlwaysOnTop(true, 'screen-saver');

  const target = rendererUrl('pin');
  if (target.url) void pinWin.loadURL(target.url);
  else void pinWin.loadFile(target.file!);

  pinWin.on('moved', () => {
    if (pinWin && !pinWin.isDestroyed()) {
      const b = pinWin.getBounds();
      pinBounds = { x: b.x, y: b.y };
    }
  });
  pinWin.on('closed', () => {
    pinWin = null;
  });
}
