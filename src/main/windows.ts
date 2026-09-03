import { BrowserWindow, screen, app } from 'electron';
import { join } from 'node:path';
import { PIN_SIZES } from '@shared/types.js';
import { loadSettings } from './db/settings-store.js';

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

  // Apply the fit-to-workarea zoom once the page is loaded (setZoomFactor set
  // before load can be dropped); positionPopover refines it per-display on show.
  popover.webContents.on('did-finish-load', () => {
    if (popover && !popover.isDestroyed()) {
      fitPopover(popover, screen.getPrimaryDisplay().workArea);
    }
  });

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

/** Popover design size at 1.0x zoom. */
const POPOVER_BASE = { w: 340, h: 600 };

/**
 * Scale the popover down to fit the display's work area (short laptop screens
 * are often less than 600px tall, which would clip the card's bottom). Returns
 * the fitted content size to position against.
 */
function fitPopover(win: BrowserWindow, workArea: Electron.Rectangle): { width: number; height: number } {
  const zoom = Math.max(0.6, Math.min(1, (workArea.height - 16) / POPOVER_BASE.h));
  const width = Math.round(POPOVER_BASE.w * zoom);
  const height = Math.round(POPOVER_BASE.h * zoom);
  win.setContentSize(width, height);
  win.webContents.setZoomFactor(zoom);
  return { width, height };
}

function positionPopover(win: BrowserWindow, trayBounds?: Electron.Rectangle): void {
  // Prefer the display the tray sits on; fall back to the primary display.
  const display = trayBounds
    ? screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
    : screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const { width, height } = fitPopover(win, workArea);

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

  // Size the window relative to the display it opens on (the one under the
  // cursor), so it fits a small laptop and grows on a large monitor.
  const startDisp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const init = dashboardBounds(startDisp);

  dashboard = new BrowserWindow({
    ...init,
    minWidth: 640,
    minHeight: 480,
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

  dashboard.once('ready-to-show', () => {
    applyDashboardZoom();
    dashboard?.show();
  });
  dashboard.webContents.on('did-finish-load', () => applyDashboardZoom());
  // Rescale the UI whenever the window size changes (resize / maximize /
  // fullscreen), so bigger windows get bigger content, not just margins.
  let resizeTimer: NodeJS.Timeout | null = null;
  const rescale = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => applyDashboardZoom(), 60);
  };
  dashboard.on('resize', rescale);
  dashboard.on('maximize', () => applyDashboardZoom());
  dashboard.on('unmaximize', () => applyDashboardZoom());
  dashboard.on('enter-full-screen', () => applyDashboardZoom());
  dashboard.on('leave-full-screen', () => applyDashboardZoom());
  // When dragged onto a different display, rescale the UI to that screen.
  dashboard.on('moved', () => {
    const id = screen.getDisplayMatching(dashboard!.getBounds()).id;
    if (id !== dashboardDisplayId) {
      dashboardDisplayId = id;
      applyDashboardZoom();
    }
  });
  dashboard.on('closed', () => {
    dashboard = null;
  });
  dashboardDisplayId = startDisp.id;
  wireDashboardDisplayEvents();

  return dashboard;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Target window bounds for a display: ~80% of its work area, clamped, centred. */
function dashboardBounds(display: Electron.Display): Electron.Rectangle {
  const wa = display.workArea;
  const width = clamp(Math.round(wa.width * 0.82), 760, 1440);
  const height = clamp(Math.round(wa.height * 0.86), 520, 960);
  return {
    x: wa.x + Math.round((wa.width - width) / 2),
    y: wa.y + Math.round((wa.height - height) / 2),
    width,
    height
  };
}

/** Zoom the dashboard content to suit the CURRENT window size, so a maximized
 *  or fullscreen window scales the whole UI up instead of just adding side
 *  margins. Baseline ~1000×680 content = 1.0x. */
function applyDashboardZoom(): void {
  if (!dashboard || dashboard.isDestroyed()) return;
  const [w, h] = dashboard.getContentSize();
  // Baselines are the natural content size at 1.0x. Height is the binding
  // constraint (the timer card + stat row is tall), so keep it close to the
  // real content height, otherwise short laptop screens over-zoom and the page
  // spills into a scrollbar. Allow shrinking below 1.0 so it always fits.
  const zoom = clamp(Math.min(w / 1040, h / 900), 0.8, 1.6);
  dashboard.webContents.setZoomFactor(zoom);
}

let dashboardDisplayId: number | null = null;
let dashboardDisplayEventsWired = false;

/** Re-fit the dashboard when displays change (monitor plugged/unplugged, DPI). */
function wireDashboardDisplayEvents(): void {
  if (dashboardDisplayEventsWired) return;
  dashboardDisplayEventsWired = true;
  const refit = () => {
    if (!dashboard || dashboard.isDestroyed()) return;
    const disp = screen.getDisplayMatching(dashboard.getBounds());
    dashboard.setBounds(dashboardBounds(disp));
    dashboardDisplayId = disp.id;
    applyDashboardZoom();
  };
  screen.on('display-metrics-changed', refit);
  screen.on('display-added', refit);
  screen.on('display-removed', refit);
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

/** The pin window (or null) — used by boot-time diagnostics. */
export function getPinWindow(): BrowserWindow | null {
  return pinWin;
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

/**
 * Resize the pinned window to fit its rendered content. The renderer measures
 * the visible card (it varies with the size preset, DPI, and system font) and
 * reports the exact CSS pixels, so nothing is ever clipped regardless of the
 * display. Keeps the window on screen after growing.
 */
export function resizePinTo(width: number, height: number): void {
  if (!pinWin || pinWin.isDestroyed()) return;
  const w = Math.max(120, Math.round(width));
  const h = Math.max(48, Math.round(height));
  const [cw, ch] = pinWin.getContentSize();
  if (cw === w && ch === h) return; // already the right size — avoid churn
  pinWin.setContentSize(w, h);
  // Re-clamp onto the current display's work area now that the size changed.
  const b = pinWin.getBounds();
  const { workArea } = screen.getDisplayMatching(b);
  const x = Math.max(workArea.x, Math.min(b.x, workArea.x + workArea.width - b.width));
  const y = Math.max(workArea.y, Math.min(b.y, workArea.y + workArea.height - b.height));
  pinWin.setPosition(x, y);
  pinBounds = { x, y };
}

/** Move the pinned window by a pixel delta (used while dragging it). */
export function movePinBy(dx: number, dy: number): void {
  if (!pinWin || pinWin.isDestroyed()) return;
  // Ignore bad deltas — a non-finite value would make setPosition throw a
  // native "conversion failure" and crash the main process.
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  const [x, y] = pinWin.getPosition();
  const nx = Math.round(x + dx);
  const ny = Math.round(y + dy);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
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
  const { w: width, h: height } = PIN_SIZES[loadSettings().pinSize];
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
      sandbox: false,
      // Keep the renderer running at full rate when another app is focused.
      // Otherwise Chromium throttles this background window and the
      // self-sizing ResizeObserver lags, leaving the card clipped until it
      // regains focus.
      backgroundThrottling: false
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
