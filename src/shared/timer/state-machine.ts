/**
 * Pure timer/session state machine.
 *
 * All transitions go through `reduce(state, action, config, now)`. The function
 * is deterministic: it never touches the clock, so tests can drive it with any
 * `now` value. The Electron main process wires a single 1s interval that calls
 * `reduce(..., { type: 'TICK' }, ...)` and reacts to the emitted events.
 */

import type {
  Phase,
  ReduceResult,
  TimerAction,
  TimerConfig,
  TimerEvent,
  TimerState
} from './types.js';

export const DEFAULT_CONFIG: TimerConfig = {
  workDurationMs: 25 * 60 * 1000,
  breakDurationMs: 5 * 60 * 1000,
  longBreakDurationMs: 15 * 60 * 1000,
  sessionsBeforeLongBreak: 4,
  autoTransition: true
};

export function createInitialState(config: TimerConfig = DEFAULT_CONFIG): TimerState {
  return {
    status: 'idle',
    phase: 'work',
    remainingMs: config.workDurationMs,
    totalMs: config.workDurationMs,
    runStartedAt: null,
    phaseStartedAt: null,
    workCyclesCompleted: 0
  };
}

function phaseDuration(phase: Phase, config: TimerConfig): number {
  return phase === 'work' ? config.workDurationMs : config.breakDurationMs;
}

/**
 * Live remaining time for a (possibly running) state, clamped at 0.
 * Pure helper — safe to call from renderers to render a smooth countdown.
 */
export function liveRemainingMs(state: TimerState, now: number): number {
  if (state.status === 'running' && state.runStartedAt !== null) {
    const elapsed = now - state.runStartedAt;
    return Math.max(0, state.remainingMs - elapsed);
  }
  return Math.max(0, state.remainingMs);
}

/** Elapsed time within the current phase (ms). */
export function elapsedInPhaseMs(state: TimerState, now: number): number {
  return Math.max(0, state.totalMs - liveRemainingMs(state, now));
}

/** Progress through the current phase in the range [0, 1]. */
export function progress(state: TimerState, now: number): number {
  if (state.totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, elapsedInPhaseMs(state, now) / state.totalMs));
}

function beginPhase(
  phase: Phase,
  config: TimerConfig,
  now: number,
  workCyclesCompleted: number,
  durationOverride?: number
): TimerState {
  const total = durationOverride ?? phaseDuration(phase, config);
  return {
    status: 'running',
    phase,
    remainingMs: total,
    totalMs: total,
    runStartedAt: now,
    phaseStartedAt: now,
    workCyclesCompleted
  };
}

function armPhase(
  phase: Phase,
  config: TimerConfig,
  workCyclesCompleted: number,
  durationOverride?: number
): TimerState {
  // Idle but "armed" on a specific phase, awaiting a manual START.
  const total = durationOverride ?? phaseDuration(phase, config);
  return {
    status: 'idle',
    phase,
    remainingMs: total,
    totalMs: total,
    runStartedAt: null,
    phaseStartedAt: null,
    workCyclesCompleted
  };
}

/** Whether the break following `cyclesCompleted` work phases is a long one. */
export function isLongBreakAfter(cyclesCompleted: number, config: TimerConfig): boolean {
  return (
    config.sessionsBeforeLongBreak > 0 &&
    cyclesCompleted > 0 &&
    cyclesCompleted % config.sessionsBeforeLongBreak === 0
  );
}

/**
 * Handle a phase reaching zero. Emits completion events and decides the next
 * state based on the auto-transition config.
 */
function completePhase(state: TimerState, config: TimerConfig, now: number): ReduceResult {
  const finishedPhase = state.phase;
  const events: TimerEvent[] = [];
  // Actual focused time: equals totalMs on a natural finish, but less when the
  // phase is ended early via SKIP. Never more than the planned duration.
  const elapsedMs = Math.min(state.totalMs, elapsedInPhaseMs(state, now));

  events.push({ type: 'phase-completed', phase: finishedPhase, at: now, elapsedMs });

  if (finishedPhase === 'work') {
    const cycles = state.workCyclesCompleted + 1;
    events.push({ type: 'work-completed', phase: 'work', at: now, elapsedMs });
    // Every Nth completed work phase earns a long break.
    const breakMs = isLongBreakAfter(cycles, config)
      ? config.longBreakDurationMs
      : config.breakDurationMs;
    const next = config.autoTransition
      ? beginPhase('break', config, now, cycles, breakMs)
      : armPhase('break', config, cycles, breakMs);
    return { state: next, events };
  }

  // break finished
  events.push({ type: 'break-completed', phase: 'break', at: now });
  const next = config.autoTransition
    ? beginPhase('work', config, now, state.workCyclesCompleted)
    : armPhase('work', config, state.workCyclesCompleted);
  return { state: next, events };
}

export function reduce(
  state: TimerState,
  action: TimerAction,
  config: TimerConfig,
  now: number
): ReduceResult {
  switch (action.type) {
    case 'START': {
      // Start (or restart) a phase from full duration.
      const phase = action.phase ?? state.phase;
      const next = beginPhase(phase, config, now, state.workCyclesCompleted);
      const events: TimerEvent[] = [{ type: 'session-started', phase, at: now }];
      return { state: next, events };
    }

    case 'RESUME': {
      if (state.status !== 'paused') return { state, events: [] };
      const next: TimerState = { ...state, status: 'running', runStartedAt: now };
      return { state: next, events: [{ type: 'resumed', phase: state.phase, at: now }] };
    }

    case 'PAUSE': {
      if (state.status !== 'running') return { state, events: [] };
      const remaining = liveRemainingMs(state, now);
      const next: TimerState = {
        ...state,
        status: 'paused',
        remainingMs: remaining,
        runStartedAt: null
      };
      return { state: next, events: [{ type: 'paused', phase: state.phase, at: now }] };
    }

    case 'EXTEND': {
      // Add time to the current phase (default use: +5 min). Works while
      // running or paused; also revives a just-finished phase.
      if (state.status === 'idle' && state.phaseStartedAt === null) {
        return { state, events: [] };
      }
      const currentRemaining = liveRemainingMs(state, now);
      const remaining = currentRemaining + action.ms;
      const next: TimerState = {
        ...state,
        remainingMs: remaining,
        totalMs: state.totalMs + action.ms,
        // If running, reset the run anchor so live remaining stays consistent.
        runStartedAt: state.status === 'running' ? now : null
      };
      return { state: next, events: [{ type: 'extended', phase: state.phase, at: now }] };
    }

    case 'RESET': {
      // Restart the current phase from full duration, preserving status intent:
      // a running timer keeps running; anything else becomes idle-armed.
      const total = phaseDuration(state.phase, config);
      const wasRunning = state.status === 'running';
      const next: TimerState = {
        status: wasRunning ? 'running' : 'idle',
        phase: state.phase,
        remainingMs: total,
        totalMs: total,
        runStartedAt: wasRunning ? now : null,
        phaseStartedAt: wasRunning ? now : null,
        workCyclesCompleted: state.workCyclesCompleted
      };
      return { state: next, events: [{ type: 'reset', phase: state.phase, at: now }] };
    }

    case 'STOP': {
      // End the session entirely and return to a fresh idle work state.
      const events: TimerEvent[] = [];
      const wasActive = state.status !== 'idle' || state.phaseStartedAt !== null;
      if (wasActive) {
        const elapsedMs = elapsedInPhaseMs(state, now);
        // A work phase stopped before completion counts as abandoned.
        if (state.phase === 'work' && liveRemainingMs(state, now) > 0) {
          events.push({ type: 'session-abandoned', phase: 'work', at: now, elapsedMs });
        }
        events.push({ type: 'session-stopped', phase: state.phase, at: now, elapsedMs });
      }
      return { state: createInitialState(config), events };
    }

    case 'SKIP': {
      // Immediately finish the current phase as if it hit zero.
      return completePhase(state, config, now);
    }

    case 'TICK':
    case 'RESYNC': {
      if (state.status !== 'running') return { state, events: [] };
      const remaining = liveRemainingMs(state, now);
      if (remaining <= 0) {
        return completePhase(state, config, now);
      }
      // No state churn needed on a normal tick — live remaining is derived.
      return { state, events: [] };
    }

    default: {
      // Exhaustiveness guard.
      const _never: never = action;
      return { state: _never as TimerState, events: [] };
    }
  }
}
