import { Tray, Menu, type MenuItemConstructorOptions } from 'electron';
import { renderTrayIcon } from './tray-icon.js';
import { formatClock } from '@shared/timer/format.js';
import type { TimerSnapshot } from '@shared/types.js';

/**
 * The system-tray presence. Owns the Tray instance, refreshes the icon +
 * tooltip on every snapshot, and exposes a left-click (popover) and right-click
 * (native context menu) with the full control set.
 */

export interface TrayHandlers {
  onToggle: () => void; // start/pause/resume
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onExtend: () => void;
  onReset: () => void;
  onStop: () => void;
  onOpenPopover: (bounds: Electron.Rectangle) => void;
  onOpenDashboard: () => void;
  onTogglePin: () => void;
  onQuit: () => void;
}

let tray: Tray | null = null;
let handlers: TrayHandlers | null = null;
let lastSnapshot: TimerSnapshot | null = null;
let pinned = false;

/** Update the pinned state so the context menu shows the right label. */
export function setTrayPinned(value: boolean): void {
  pinned = value;
  if (tray) tray.setContextMenu(buildMenu());
}

export function createTray(h: TrayHandlers): Tray {
  handlers = h;
  const initial: TimerSnapshot = {
    status: 'idle',
    phase: 'work',
    remainingMs: 25 * 60_000,
    totalMs: 25 * 60_000,
    progress: 0,
    workCyclesCompleted: 0,
    isLongBreak: false,
    at: Date.now()
  };
  tray = new Tray(renderTrayIcon(initial));
  tray.setToolTip('Deepbrew');

  tray.on('click', (_e, bounds) => {
    handlers?.onOpenPopover(bounds);
  });
  // Some Linux DEs only emit right-click as the context menu trigger; the menu
  // is set via setContextMenu so it appears on the platform-native gesture.
  tray.on('right-click', () => {
    if (tray) tray.popUpContextMenu(buildMenu());
  });

  updateTray(initial);
  return tray;
}

export function updateTray(snapshot: TimerSnapshot): void {
  if (!tray) return;
  lastSnapshot = snapshot;
  tray.setImage(renderTrayIcon(snapshot));
  tray.setToolTip(tooltipFor(snapshot));
  tray.setContextMenu(buildMenu());
}

function tooltipFor(s: TimerSnapshot): string {
  const phase = s.phase === 'work' ? 'Focus' : 'Break';
  if (s.status === 'idle') return `Deepbrew — ready (${phase} ${formatClock(s.totalMs)})`;
  const state = s.status === 'paused' ? 'Paused' : 'Running';
  return `Deepbrew — ${phase} ${state} · ${formatClock(s.remainingMs)} left`;
}

function buildMenu(): Menu {
  const s = lastSnapshot;
  const running = s?.status === 'running';
  const paused = s?.status === 'paused';
  const active = running || paused;

  const items: MenuItemConstructorOptions[] = [
    {
      label: s ? `${s.phase === 'work' ? 'Focus' : 'Break'} · ${formatClock(s.remainingMs)}` : 'Deepbrew',
      enabled: false
    },
    { type: 'separator' },
    running
      ? { label: 'Pause', click: () => handlers?.onPause() }
      : paused
        ? { label: 'Resume', click: () => handlers?.onResume() }
        : { label: 'Start focus', click: () => handlers?.onStart() },
    { label: 'Extend +5 min', enabled: active, click: () => handlers?.onExtend() },
    { label: 'Reset', enabled: !!s && (active || s.status !== 'idle'), click: () => handlers?.onReset() },
    { label: 'Stop session', enabled: active, click: () => handlers?.onStop() },
    { type: 'separator' },
    { label: pinned ? 'Unpin timer' : 'Pin timer on top', click: () => handlers?.onTogglePin() },
    { label: 'Open dashboard', click: () => handlers?.onOpenDashboard() },
    { type: 'separator' },
    { label: 'Quit Deepbrew', click: () => handlers?.onQuit() }
  ];

  return Menu.buildFromTemplate(items);
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
