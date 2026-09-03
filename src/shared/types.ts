/** App-wide shared types used across main, preload, and renderer. */

import type { Phase, Status } from './timer/types.js';

export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Pinned floating-timer size presets. These are only the INITIAL window size
 * hints used when the pin first opens; the renderer measures the actual card
 * and reports its exact size (IPC.pinResize), so the window always fits its
 * content regardless of DPI or system font.
 */
export type PinSize = 'compact' | 'medium' | 'large';
export const PIN_SIZES: Record<PinSize, { w: number; h: number }> = {
  compact: { w: 224, h: 74 }, // bar: time only
  medium: { w: 296, h: 104 }, // bar + small avatar
  large: { w: 240, h: 278 } // card with a prominent avatar
};
export const PIN_SIZE_ORDER: PinSize[] = ['compact', 'medium', 'large'];

export interface Settings {
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  autoTransition: boolean;
  autostart: boolean;
  theme: ThemePreference;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  /** Master switch for local analytics + active-app tracking. */
  trackingEnabled: boolean;
  /** Sub-toggle: log the focused application per session. */
  activeAppTrackingEnabled: boolean;
  /** Opt-out anonymous product analytics (app-open pings only). */
  productAnalyticsEnabled: boolean;
  /** Check for updates on launch. */
  updateCheckEnabled: boolean;
  /** Smart Nudge: warn after this many minutes of idle time mid-session. */
  smartNudgeIdleMinutes: number;
  /** Size of the pinned floating timer. */
  pinSize: PinSize;
  /** Global keyboard shortcuts (Electron accelerator strings). */
  shortcuts: {
    startPause: string;
    reset: string;
    openDashboard: string;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoTransition: true,
  autostart: false,
  theme: 'system',
  notificationsEnabled: true,
  soundEnabled: true,
  trackingEnabled: true,
  activeAppTrackingEnabled: true,
  productAnalyticsEnabled: false,
  updateCheckEnabled: true,
  smartNudgeIdleMinutes: 3,
  pinSize: 'compact',
  shortcuts: {
    startPause: 'CommandOrControl+Shift+Space',
    reset: 'CommandOrControl+Shift+R',
    openDashboard: 'CommandOrControl+Shift+D'
  }
};

/** A snapshot of live timer state broadcast to renderers. */
export interface TimerSnapshot {
  status: Status;
  phase: Phase;
  remainingMs: number;
  totalMs: number;
  progress: number;
  workCyclesCompleted: number;
  /** True when the current (or armed) break is a long break. */
  isLongBreak: boolean;
  /** Epoch ms the snapshot was produced (for renderer-side interpolation). */
  at: number;
}

/** A completed or abandoned session row, as stored/queried. */
export interface SessionRecord {
  id: number;
  phase: Phase;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  plannedMs: number;
  actualMs: number;
  completed: boolean; // true = ran to completion, false = abandoned/stopped
  appName: string | null;
}

export interface DailyStat {
  day: string; // YYYY-MM-DD
  focusMs: number;
  completedSessions: number;
  abandonedSessions: number;
}

export interface AppStat {
  appName: string;
  focusMs: number;
  sessions: number;
  /** Data-URL of the app's real icon, extracted locally from its executable;
   *  null when no icon has been captured yet (falls back to initials). */
  iconDataUrl?: string | null;
}

export interface StatsSummary {
  todayFocusMs: number;
  weekFocusMs: number;
  monthFocusMs: number;
  currentStreakDays: number;
  longestStreakDays: number;
  completedSessions: number;
  abandonedSessions: number;
  daily: DailyStat[]; // last N days
  topApps: AppStat[];
  activeDays: string[]; // YYYY-MM-DD list for streak calendar
}

export interface PersonaCardData {
  rangeLabel: string; // "Today" | "This week"
  focusHours: number;
  sessionsCompleted: number;
  currentStreakDays: number;
  /** Up to 3 apps by focus time; empty if tracking is off/unsupported. */
  topApps: AppStat[];
  /** A short evocative label for the user's work style, derived from patterns. */
  workStyle: string;
  /** One-line description of the work style. */
  workStyleBlurb: string;
  /** e.g. "Peak focus around 10 AM"; null when there's not enough data. */
  peakLabel: string | null;
  generatedAt: number;
}

export type Platform = 'win32' | 'linux' | 'darwin' | string;

export interface PlatformInfo {
  platform: Platform;
  /** Whether active-window tracking is available (false on Wayland etc.). */
  activeWindowSupported: boolean;
  activeWindowNote: string;
  appVersion: string;
}
