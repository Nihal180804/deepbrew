/**
 * The IPC contract shared by the preload bridge and the renderer.
 *
 * Channel names live here so main and renderer never drift. The preload script
 * exposes a typed `window.kofe` API (see KofeApi) built on these channels.
 */

import type {
  PersonaCardData,
  PlatformInfo,
  Settings,
  StatsSummary,
  SessionRecord,
  TimerSnapshot
} from './types.js';

export const IPC = {
  // renderer -> main (invoke)
  timerGet: 'timer:get',
  timerCommand: 'timer:command',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  statsGet: 'stats:get',
  sessionsGet: 'sessions:get',
  personaGet: 'persona:get',
  dataExport: 'data:export',
  dataDelete: 'data:delete',
  platformGet: 'platform:get',
  openDashboard: 'window:open-dashboard',
  winMinimize: 'window:minimize',
  winMaximizeToggle: 'window:maximize-toggle',
  winClose: 'window:close',
  winIsMaximized: 'window:is-maximized',
  pinToggle: 'pin:toggle',
  pinIsActive: 'pin:is-active',
  clipboardWriteImage: 'clipboard:write-image',
  savePng: 'file:save-png',

  // main -> renderer (send)
  timerUpdate: 'timer:update',
  settingsChanged: 'settings:changed',
  statsInvalidated: 'stats:invalidated'
} as const;

export type TimerCommand =
  | { type: 'start'; phase?: 'work' | 'break' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'toggle' } // start/resume if not running, else pause
  | { type: 'reset' }
  | { type: 'stop' }
  | { type: 'skip' }
  | { type: 'extend'; minutes: number };

/** Typed API surface exposed on `window.kofe` by the preload script. */
export interface KofeApi {
  getTimer(): Promise<TimerSnapshot>;
  sendCommand(cmd: TimerCommand): Promise<TimerSnapshot>;
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  getStats(days?: number): Promise<StatsSummary>;
  getSessions(limit?: number): Promise<SessionRecord[]>;
  getPersona(range: 'today' | 'week'): Promise<PersonaCardData>;
  exportData(): Promise<{ ok: boolean; path?: string }>;
  deleteAllData(): Promise<{ ok: boolean }>;
  getPlatform(): Promise<PlatformInfo>;
  openDashboard(tab?: 'timer' | 'stats' | 'settings'): Promise<void>;
  minimizeWindow(): Promise<void>;
  toggleMaximizeWindow(): Promise<boolean>;
  closeWindow(): Promise<void>;
  isWindowMaximized(): Promise<boolean>;
  /** Toggle the always-on-top floating mini timer; resolves to the new state. */
  togglePin(): Promise<boolean>;
  isPinned(): Promise<boolean>;
  copyImageToClipboard(dataUrl: string): Promise<{ ok: boolean }>;
  savePng(dataUrl: string, suggestedName: string): Promise<{ ok: boolean; path?: string }>;

  onTimerUpdate(cb: (snapshot: TimerSnapshot) => void): () => void;
  onSettingsChanged(cb: (settings: Settings) => void): () => void;
  onStatsInvalidated(cb: () => void): () => void;
}

declare global {
  interface Window {
    kofe: KofeApi;
  }
}
