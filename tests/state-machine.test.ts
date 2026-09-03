import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIG,
  createInitialState,
  reduce,
  liveRemainingMs,
  elapsedInPhaseMs,
  progress
} from '../src/shared/timer/state-machine.js';
import type { TimerConfig, TimerState } from '../src/shared/timer/types.js';

const MIN = 60 * 1000;

const cfg = (over: Partial<TimerConfig> = {}): TimerConfig => ({
  ...DEFAULT_CONFIG,
  ...over
});

// Small helper: run a sequence of actions from a start state.
function run(
  state: TimerState,
  steps: Array<[Parameters<typeof reduce>[1], number]>,
  config: TimerConfig
) {
  let s = state;
  const allEvents = [];
  for (const [action, now] of steps) {
    const res = reduce(s, action, config, now);
    s = res.state;
    allEvents.push(...res.events);
  }
  return { state: s, events: allEvents };
}

describe('createInitialState', () => {
  it('starts idle on the work phase with full work duration', () => {
    const s = createInitialState(cfg());
    expect(s.status).toBe('idle');
    expect(s.phase).toBe('work');
    expect(s.remainingMs).toBe(25 * MIN);
    expect(s.totalMs).toBe(25 * MIN);
    expect(s.runStartedAt).toBeNull();
  });
});

describe('START', () => {
  it('begins a running work phase', () => {
    const s0 = createInitialState(cfg());
    const { state, events } = reduce(s0, { type: 'START' }, cfg(), 1000);
    expect(state.status).toBe('running');
    expect(state.phase).toBe('work');
    expect(state.runStartedAt).toBe(1000);
    expect(state.phaseStartedAt).toBe(1000);
    expect(events.map((e) => e.type)).toContain('session-started');
  });

  it('can start a specific phase', () => {
    const s0 = createInitialState(cfg());
    const { state } = reduce(s0, { type: 'START', phase: 'break' }, cfg(), 0);
    expect(state.phase).toBe('break');
    expect(state.totalMs).toBe(5 * MIN);
  });
});

describe('live remaining derivation', () => {
  it('counts down while running without mutating state', () => {
    const s0 = createInitialState(cfg());
    const { state } = reduce(s0, { type: 'START' }, cfg(), 0);
    expect(liveRemainingMs(state, 0)).toBe(25 * MIN);
    expect(liveRemainingMs(state, 60_000)).toBe(24 * MIN);
    expect(liveRemainingMs(state, 25 * MIN)).toBe(0);
    // state itself is untouched
    expect(state.remainingMs).toBe(25 * MIN);
  });

  it('clamps at zero and never goes negative', () => {
    const s0 = createInitialState(cfg());
    const { state } = reduce(s0, { type: 'START' }, cfg(), 0);
    expect(liveRemainingMs(state, 999 * MIN)).toBe(0);
  });

  it('reports progress and elapsed correctly', () => {
    const s0 = createInitialState(cfg({ workDurationMs: 10 * MIN }));
    const { state } = reduce(s0, { type: 'START' }, cfg({ workDurationMs: 10 * MIN }), 0);
    expect(elapsedInPhaseMs(state, 5 * MIN)).toBe(5 * MIN);
    expect(progress(state, 5 * MIN)).toBeCloseTo(0.5);
    expect(progress(state, 10 * MIN)).toBe(1);
  });
});

describe('PAUSE / RESUME', () => {
  it('freezes remaining on pause and resumes from the same point', () => {
    const s0 = createInitialState(cfg());
    let s = reduce(s0, { type: 'START' }, cfg(), 0).state;
    s = reduce(s, { type: 'PAUSE' }, cfg(), 60_000).state;
    expect(s.status).toBe('paused');
    expect(s.remainingMs).toBe(24 * MIN);
    // Time passing while paused does not change remaining.
    expect(liveRemainingMs(s, 5 * MIN)).toBe(24 * MIN);

    s = reduce(s, { type: 'RESUME' }, cfg(), 5 * MIN).state;
    expect(s.status).toBe('running');
    // 24 min remained; 1 more minute of real time elapses after resume.
    expect(liveRemainingMs(s, 6 * MIN)).toBe(23 * MIN);
  });

  it('ignores pause when not running and resume when not paused', () => {
    const s0 = createInitialState(cfg());
    expect(reduce(s0, { type: 'PAUSE' }, cfg(), 0).state.status).toBe('idle');
    expect(reduce(s0, { type: 'RESUME' }, cfg(), 0).state.status).toBe('idle');
  });
});

describe('EXTEND', () => {
  it('adds time to a running phase and bumps total', () => {
    const s0 = createInitialState(cfg());
    let s = reduce(s0, { type: 'START' }, cfg(), 0).state;
    // 1 minute in, extend by 5.
    s = reduce(s, { type: 'EXTEND', ms: 5 * MIN }, cfg(), 60_000).state;
    expect(liveRemainingMs(s, 60_000)).toBe(24 * MIN + 5 * MIN);
    expect(s.totalMs).toBe(30 * MIN);
  });

  it('extends a paused phase', () => {
    const s0 = createInitialState(cfg());
    let s = reduce(s0, { type: 'START' }, cfg(), 0).state;
    s = reduce(s, { type: 'PAUSE' }, cfg(), 60_000).state;
    s = reduce(s, { type: 'EXTEND', ms: 5 * MIN }, cfg(), 120_000).state;
    expect(s.remainingMs).toBe(24 * MIN + 5 * MIN);
    expect(s.status).toBe('paused');
  });
});

describe('phase completion via TICK', () => {
  it('auto-transitions work -> break -> work when enabled', () => {
    const c = cfg({ workDurationMs: 10 * MIN, breakDurationMs: 2 * MIN, autoTransition: true });
    const s = reduce(createInitialState(c), { type: 'START' }, c, 0).state;

    // Tick before completion: no change.
    let res = reduce(s, { type: 'TICK' }, c, 5 * MIN);
    expect(res.events).toHaveLength(0);

    // Tick at/after completion: work completes, break begins running.
    res = reduce(s, { type: 'TICK' }, c, 10 * MIN);
    expect(res.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['phase-completed', 'work-completed'])
    );
    expect(res.state.phase).toBe('break');
    expect(res.state.status).toBe('running');
    expect(res.state.workCyclesCompleted).toBe(1);

    // Break completes -> back to running work.
    const afterBreak = reduce(res.state, { type: 'TICK' }, c, 12 * MIN);
    expect(afterBreak.events.map((e) => e.type)).toContain('break-completed');
    expect(afterBreak.state.phase).toBe('work');
    expect(afterBreak.state.status).toBe('running');
  });

  it('arms the next phase for manual start when auto-transition is off', () => {
    const c = cfg({ workDurationMs: 10 * MIN, autoTransition: false });
    const s = reduce(createInitialState(c), { type: 'START' }, c, 0).state;
    const res = reduce(s, { type: 'TICK' }, c, 10 * MIN);
    expect(res.state.phase).toBe('break');
    expect(res.state.status).toBe('idle');
    expect(res.state.remainingMs).toBe(c.breakDurationMs);
  });
});

describe('SKIP', () => {
  it('finishes the current phase immediately', () => {
    const c = cfg({ autoTransition: true });
    const s = reduce(createInitialState(c), { type: 'START' }, c, 0).state;
    const res = reduce(s, { type: 'SKIP' }, c, 3 * MIN);
    expect(res.events.map((e) => e.type)).toContain('work-completed');
    expect(res.state.phase).toBe('break');
  });
});

describe('RESET', () => {
  it('restores a running phase to full duration and keeps running', () => {
    const s0 = createInitialState(cfg());
    let s = reduce(s0, { type: 'START' }, cfg(), 0).state;
    s = reduce(s, { type: 'RESET' }, cfg(), 5 * MIN).state;
    expect(s.status).toBe('running');
    expect(liveRemainingMs(s, 5 * MIN)).toBe(25 * MIN);
  });
});

describe('STOP', () => {
  it('marks an incomplete work phase as abandoned and returns to idle', () => {
    const s0 = createInitialState(cfg());
    const s = reduce(s0, { type: 'START' }, cfg(), 0).state;
    const res = reduce(s, { type: 'STOP' }, cfg(), 5 * MIN);
    const types = res.events.map((e) => e.type);
    expect(types).toContain('session-abandoned');
    expect(types).toContain('session-stopped');
    expect(res.state.status).toBe('idle');
    expect(res.state.phase).toBe('work');
    expect(res.state.remainingMs).toBe(25 * MIN);
  });

  it('does not mark abandoned if the work phase already completed', () => {
    const c = cfg({ workDurationMs: 10 * MIN, autoTransition: false });
    let s = reduce(createInitialState(c), { type: 'START' }, c, 0).state;
    s = reduce(s, { type: 'TICK' }, c, 10 * MIN).state; // work complete -> armed break
    const res = reduce(s, { type: 'STOP' }, c, 11 * MIN);
    expect(res.events.map((e) => e.type)).not.toContain('session-abandoned');
  });
});

describe('RESYNC after sleep/wake', () => {
  it('completes the phase if the wake time is past the deadline', () => {
    const c = cfg({ workDurationMs: 10 * MIN, autoTransition: true });
    const s = reduce(createInitialState(c), { type: 'START' }, c, 0).state;
    // Machine slept; we wake up well past the deadline.
    const res = reduce(s, { type: 'RESYNC' }, c, 30 * MIN);
    expect(res.events.map((e) => e.type)).toContain('work-completed');
    expect(res.state.phase).toBe('break');
  });
});

describe('long break cadence', () => {
  it('makes every Nth break a long break', () => {
    const c = cfg({
      workDurationMs: 1 * MIN,
      breakDurationMs: 1 * MIN,
      longBreakDurationMs: 3 * MIN,
      sessionsBeforeLongBreak: 2,
      autoTransition: true
    });
    let s = reduce(createInitialState(c), { type: 'START' }, c, 0).state;
    // Work 1 done -> short break (cycle 1, not multiple of 2).
    s = reduce(s, { type: 'TICK' }, c, 1 * MIN).state;
    expect(s.phase).toBe('break');
    expect(s.totalMs).toBe(1 * MIN);
    // Break done -> work; work 2 done -> LONG break (cycle 2).
    s = reduce(s, { type: 'TICK' }, c, 2 * MIN).state; // break done -> work
    s = reduce(s, { type: 'TICK' }, c, 3 * MIN).state; // work 2 done -> long break
    expect(s.phase).toBe('break');
    expect(s.totalMs).toBe(3 * MIN);
    expect(s.workCyclesCompleted).toBe(2);
  });

  it('never triggers a long break when sessionsBeforeLongBreak is 0', () => {
    const c = cfg({
      workDurationMs: 1 * MIN,
      breakDurationMs: 1 * MIN,
      longBreakDurationMs: 3 * MIN,
      sessionsBeforeLongBreak: 0,
      autoTransition: true
    });
    let s = reduce(createInitialState(c), { type: 'START' }, c, 0).state;
    s = reduce(s, { type: 'TICK' }, c, 1 * MIN).state;
    expect(s.totalMs).toBe(1 * MIN); // always short
  });
});

describe('full pomodoro chain', () => {
  it('accumulates work cycles across several rounds', () => {
    const c = cfg({ workDurationMs: 1 * MIN, breakDurationMs: 1 * MIN, autoTransition: true });
    const { state } = run(
      createInitialState(c),
      [
        [{ type: 'START' }, 0],
        [{ type: 'TICK' }, 1 * MIN], // work 1 done -> break
        [{ type: 'TICK' }, 2 * MIN], // break done -> work
        [{ type: 'TICK' }, 3 * MIN], // work 2 done -> break
        [{ type: 'TICK' }, 4 * MIN] // break done -> work
      ],
      c
    );
    expect(state.workCyclesCompleted).toBe(2);
    expect(state.phase).toBe('work');
    expect(state.status).toBe('running');
  });
});
