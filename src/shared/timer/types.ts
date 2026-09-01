/**
 * Core timer domain types.
 *
 * The state machine is intentionally pure: it never reads the wall clock,
 * schedules timers, or performs I/O. Callers inject `now` (epoch ms) into
 * every action so the whole thing is deterministic and unit-testable.
 */

export type Phase = 'work' | 'break';

export type Status = 'idle' | 'running' | 'paused';

export interface TimerConfig {
  /** Length of a focus (work) phase, in milliseconds. */
  workDurationMs: number;
  /** Length of a break phase, in milliseconds. */
  breakDurationMs: number;
  /** Length of a long break, in milliseconds. */
  longBreakDurationMs: number;
  /** After this many completed work phases, the next break is a long one. */
  sessionsBeforeLongBreak: number;
  /**
   * When true, work → break → work happens automatically. When false, each
   * phase ends in an idle-but-armed state that requires an explicit start.
   */
  autoTransition: boolean;
}

export interface TimerState {
  status: Status;
  phase: Phase;
  /**
   * Remaining time captured at the moment of the last state change. While
   * running, the live remaining is `remainingMs - (now - runStartedAt)`.
   */
  remainingMs: number;
  /** Total duration of the current phase (for progress rendering). */
  totalMs: number;
  /** Epoch ms when the current *running* segment began; null when not running. */
  runStartedAt: number | null;
  /** Epoch ms when the current phase (work or break) was first started. */
  phaseStartedAt: number | null;
  /** Completed work phases in the current auto-transition chain. */
  workCyclesCompleted: number;
}

export type TimerAction =
  | { type: 'START'; phase?: Phase }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'STOP' }
  | { type: 'EXTEND'; ms: number }
  | { type: 'SKIP' }
  | { type: 'TICK' }
  /** Re-sync live remaining after a system sleep/wake or clock jump. */
  | { type: 'RESYNC' };

export type TimerEventType =
  | 'session-started'
  | 'phase-completed'
  | 'work-completed'
  | 'break-completed'
  | 'session-stopped'
  | 'session-abandoned'
  | 'paused'
  | 'resumed'
  | 'extended'
  | 'reset';

export interface TimerEvent {
  type: TimerEventType;
  phase: Phase;
  /** Epoch ms at which the event occurred. */
  at: number;
  /**
   * Elapsed focus time (ms) associated with the event, when meaningful —
   * e.g. how long a work phase actually ran before completing/stopping.
   */
  elapsedMs?: number;
}

export interface ReduceResult {
  state: TimerState;
  events: TimerEvent[];
}
