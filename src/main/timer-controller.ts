import { powerMonitor } from 'electron';
import {
  DEFAULT_CONFIG,
  createInitialState,
  reduce,
  liveRemainingMs,
  progress as progressOf
} from '@shared/timer/state-machine.js';
import type { TimerConfig, TimerState, TimerEvent, Phase } from '@shared/timer/types.js';
import type { Settings, TimerSnapshot } from '@shared/types.js';
import { insertSession } from './db/analytics-store.js';
import { getActiveApp } from './active-window.js';
import { cacheAppIcon } from './app-icons.js';

/**
 * Runtime owner of the timer. Holds the single source of truth (TimerState),
 * runs ONE 1s interval (only while a phase is running — never a busy loop when
 * idle/paused), records finished sessions to SQLite, samples the active app,
 * fires notifications + Smart Nudges, and broadcasts snapshots to renderers.
 */

export interface TimerControllerDeps {
  getSettings: () => Settings;
  onSnapshot: (snapshot: TimerSnapshot) => void;
  onStatsChanged: () => void;
  notify: (opts: { title: string; body: string }) => void;
}

const APP_SAMPLE_INTERVAL_MS = 15_000;

export class TimerController {
  private state: TimerState;
  private config: TimerConfig;
  private tickHandle: NodeJS.Timeout | null = null;
  private appSampleHandle: NodeJS.Timeout | null = null;
  private appSamples = new Map<string, number>();
  private nudgedThisPhase = false;
  private readonly deps: TimerControllerDeps;

  constructor(deps: TimerControllerDeps) {
    this.deps = deps;
    this.config = configFromSettings(deps.getSettings());
    this.state = createInitialState(this.config);
    this.wirePowerEvents();
  }

  // ---- public API ---------------------------------------------------------

  getSnapshot(now = Date.now()): TimerSnapshot {
    const isLongBreak =
      this.state.phase === 'break' &&
      this.state.totalMs >= this.config.longBreakDurationMs &&
      this.config.longBreakDurationMs > this.config.breakDurationMs;
    return {
      status: this.state.status,
      phase: this.state.phase,
      remainingMs: liveRemainingMs(this.state, now),
      totalMs: this.state.totalMs,
      progress: progressOf(this.state, now),
      workCyclesCompleted: this.state.workCyclesCompleted,
      isLongBreak,
      at: now
    };
  }

  applySettings(settings: Settings): void {
    this.config = configFromSettings(settings);
    // If idle, re-arm the current phase to reflect new durations immediately.
    if (this.state.status === 'idle' && this.state.phaseStartedAt === null) {
      this.state = createInitialState(this.config);
      this.emit();
    }
  }

  start(phase?: Phase): void {
    this.dispatch({ type: 'START', phase });
  }
  pause(): void {
    this.dispatch({ type: 'PAUSE' });
  }
  resume(): void {
    this.dispatch({ type: 'RESUME' });
  }
  toggle(): void {
    if (this.state.status === 'running') this.pause();
    else if (this.state.status === 'paused') this.resume();
    else this.start();
  }
  reset(): void {
    this.dispatch({ type: 'RESET' });
  }
  stop(): void {
    this.dispatch({ type: 'STOP' });
  }
  skip(): void {
    this.dispatch({ type: 'SKIP' });
  }
  extend(minutes: number): void {
    this.dispatch({ type: 'EXTEND', ms: Math.round(minutes * 60_000) });
  }

  dispose(): void {
    this.stopTicking();
    this.stopAppSampling();
  }

  // ---- internals ----------------------------------------------------------

  private dispatch(action: Parameters<typeof reduce>[1]): void {
    const now = Date.now();
    const prev = this.state;
    const { state, events } = reduce(this.state, action, this.config, now);
    this.state = state;
    this.handleEvents(prev, events, now);
    this.syncTicking();
    this.emit(now);
  }

  private handleEvents(prev: TimerState, events: TimerEvent[], now: number): void {
    let statsChanged = false;

    for (const ev of events) {
      switch (ev.type) {
        case 'work-completed': {
          this.recordSession(prev, true, ev.elapsedMs ?? prev.totalMs, now);
          statsChanged = true;
          const s = this.deps.getSettings();
          const longBreak = this.state.phase === 'break' && this.state.totalMs >= this.config.longBreakDurationMs;
          const breakWord = longBreak ? 'a longer break' : 'a break';
          this.deps.notify({
            title: 'Focus session complete ☕',
            body: s.autoTransition
              ? `Nice work. Time for ${breakWord}.`
              : `Nice work. Start ${breakWord} when ready.`
          });
          this.resetPhaseBookkeeping();
          break;
        }

        case 'break-completed': {
          this.recordSession(prev, true, ev.elapsedMs ?? prev.totalMs, now);
          statsChanged = true;
          const s = this.deps.getSettings();
          this.deps.notify({
            title: 'Break over',
            body: s.autoTransition ? 'Back to focus.' : 'Start your next focus session when ready.'
          });
          this.resetPhaseBookkeeping();
          break;
        }

        case 'session-abandoned':
          this.recordSession(prev, false, ev.elapsedMs ?? 0, now);
          statsChanged = true;
          this.resetPhaseBookkeeping();
          break;

        default:
          break;
      }
    }

    // A fresh running phase (explicit START or auto-transition) needs
    // bookkeeping: reset nudge state and (re)start active-app sampling.
    const startedNewPhase =
      prev.phaseStartedAt !== this.state.phaseStartedAt &&
      this.state.phaseStartedAt !== null &&
      this.state.status === 'running';
    if (startedNewPhase) this.beginPhaseBookkeeping();

    if (statsChanged) this.deps.onStatsChanged();
  }

  private recordSession(prev: TimerState, completed: boolean, actualMs: number, now: number): void {
    const settings = this.deps.getSettings();
    if (!settings.trackingEnabled) return;
    const startedAt = prev.phaseStartedAt ?? now - actualMs;
    insertSession({
      phase: prev.phase,
      startedAt,
      endedAt: now,
      plannedMs: prev.totalMs,
      actualMs: Math.max(0, Math.round(actualMs)),
      completed,
      appName: prev.phase === 'work' ? this.dominantApp() : null
    });
  }

  private dominantApp(): string | null {
    const settings = this.deps.getSettings();
    if (!settings.activeAppTrackingEnabled) return null;
    let best: string | null = null;
    let bestCount = 0;
    for (const [app, count] of this.appSamples) {
      if (count > bestCount) {
        best = app;
        bestCount = count;
      }
    }
    return best;
  }

  private beginPhaseBookkeeping(): void {
    this.nudgedThisPhase = false;
    this.appSamples.clear();
    this.startAppSampling();
    void this.sampleApp();
  }

  private resetPhaseBookkeeping(): void {
    this.appSamples.clear();
    this.nudgedThisPhase = false;
    this.stopAppSampling();
  }

  // ---- ticking ------------------------------------------------------------

  private syncTicking(): void {
    if (this.state.status === 'running') this.startTicking();
    else this.stopTicking();
  }

  private startTicking(): void {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this.onTick(), 1000);
  }

  private stopTicking(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private onTick(): void {
    const now = Date.now();
    const prev = this.state;
    const { state, events } = reduce(this.state, { type: 'TICK' }, this.config, now);
    this.state = state;
    if (events.length > 0) this.handleEvents(prev, events, now);
    this.maybeSmartNudge(now);
    this.syncTicking();
    this.emit(now);
  }

  private emit(now = Date.now()): void {
    this.deps.onSnapshot(this.getSnapshot(now));
  }

  // ---- active-app sampling ------------------------------------------------

  private startAppSampling(): void {
    if (this.appSampleHandle) return;
    const settings = this.deps.getSettings();
    if (!settings.trackingEnabled || !settings.activeAppTrackingEnabled) return;
    this.appSampleHandle = setInterval(() => void this.sampleApp(), APP_SAMPLE_INTERVAL_MS);
  }

  private stopAppSampling(): void {
    if (this.appSampleHandle) {
      clearInterval(this.appSampleHandle);
      this.appSampleHandle = null;
    }
  }

  private async sampleApp(): Promise<void> {
    if (this.state.status !== 'running' || this.state.phase !== 'work') return;
    const settings = this.deps.getSettings();
    if (!settings.trackingEnabled || !settings.activeAppTrackingEnabled) return;
    const active = await getActiveApp();
    if (active) {
      this.appSamples.set(active.name, (this.appSamples.get(active.name) ?? 0) + 1);
      // Extract & cache the app's real icon (best-effort, fire-and-forget).
      void cacheAppIcon(active.name, active.path);
    }
  }

  // ---- smart nudge --------------------------------------------------------

  private maybeSmartNudge(now: number): void {
    if (this.state.status !== 'running' || this.state.phase !== 'work') return;
    if (this.nudgedThisPhase) return;
    const settings = this.deps.getSettings();
    if (!settings.notificationsEnabled) return;

    const idleSeconds = safeIdleSeconds();
    const idleThreshold = settings.smartNudgeIdleMinutes * 60;
    const remaining = liveRemainingMs(this.state, now);

    // Nudge if the user has been idle a while mid-session (walked away), and
    // there's still meaningful time left on the clock.
    if (idleThreshold > 0 && idleSeconds >= idleThreshold && remaining > 60_000) {
      this.nudgedThisPhase = true;
      this.deps.notify({
        title: 'Still focusing?',
        body: `You've been idle for a few minutes. Take a break or wrap up when you're ready.`
      });
    }
  }

  // ---- power events -------------------------------------------------------

  private wirePowerEvents(): void {
    // On resume from sleep, re-sync: a phase may have elapsed while asleep.
    powerMonitor.on('resume', () => this.onResync());
    powerMonitor.on('unlock-screen', () => this.onResync());
  }

  private onResync(): void {
    const now = Date.now();
    const prev = this.state;
    const { state, events } = reduce(this.state, { type: 'RESYNC' }, this.config, now);
    this.state = state;
    if (events.length > 0) this.handleEvents(prev, events, now);
    this.syncTicking();
    this.emit(now);
  }
}

function configFromSettings(s: Settings): TimerConfig {
  return {
    ...DEFAULT_CONFIG,
    workDurationMs: Math.max(1, s.workMinutes) * 60_000,
    breakDurationMs: Math.max(1, s.breakMinutes) * 60_000,
    longBreakDurationMs: Math.max(1, s.longBreakMinutes) * 60_000,
    sessionsBeforeLongBreak: Math.max(0, s.sessionsBeforeLongBreak),
    autoTransition: s.autoTransition
  };
}

function safeIdleSeconds(): number {
  try {
    return powerMonitor.getSystemIdleTime();
  } catch {
    return 0;
  }
}
