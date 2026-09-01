import { describe, it, expect } from 'vitest';
import { deriveWorkStyle, type WorkStyleInput } from '../src/shared/work-style.js';

const base: WorkStyleInput = {
  focusHours: 2,
  completedSessions: 4,
  abandonedSessions: 0,
  avgCompletedMinutes: 25,
  distinctApps: 2,
  currentStreakDays: 0,
  rangeDays: 1
};

describe('deriveWorkStyle', () => {
  it('returns Fresh Cup when there is essentially no activity', () => {
    expect(
      deriveWorkStyle({ ...base, focusHours: 0, completedSessions: 0, avgCompletedMinutes: 0 }).workStyle
    ).toBe('Fresh Cup');
  });

  it('detects a Deep Diver from long, high-completion sessions', () => {
    expect(
      deriveWorkStyle({ ...base, avgCompletedMinutes: 50, completedSessions: 3, abandonedSessions: 0 })
        .workStyle
    ).toBe('Deep Diver');
  });

  it('detects a Sprinter from many short sessions', () => {
    expect(
      deriveWorkStyle({ ...base, avgCompletedMinutes: 15, completedSessions: 6 }).workStyle
    ).toBe('Sprinter');
  });

  it('detects a Marathoner from high total hours', () => {
    expect(deriveWorkStyle({ ...base, focusHours: 5, avgCompletedMinutes: 25 }).workStyle).toBe(
      'Marathoner'
    );
  });

  it('uses a higher marathon threshold for weekly ranges', () => {
    // 5h over a week is not a marathon; 12h+ is.
    expect(deriveWorkStyle({ ...base, rangeDays: 7, focusHours: 5 }).workStyle).not.toBe('Marathoner');
    expect(deriveWorkStyle({ ...base, rangeDays: 7, focusHours: 13 }).workStyle).toBe('Marathoner');
  });

  it('detects a Steady Brewer from an active streak', () => {
    expect(deriveWorkStyle({ ...base, currentStreakDays: 4 }).workStyle).toBe('Steady Brewer');
  });

  it('detects a Context Shifter from many apps', () => {
    expect(deriveWorkStyle({ ...base, distinctApps: 6, currentStreakDays: 0 }).workStyle).toBe(
      'Context Shifter'
    );
  });

  it('detects a Restless Starter from a low completion rate', () => {
    expect(
      deriveWorkStyle({
        ...base,
        completedSessions: 1,
        abandonedSessions: 4,
        avgCompletedMinutes: 25,
        distinctApps: 1
      }).workStyle
    ).toBe('Restless Starter');
  });

  it('falls back to Focused Mind', () => {
    expect(
      deriveWorkStyle({
        ...base,
        completedSessions: 2,
        abandonedSessions: 0,
        avgCompletedMinutes: 25,
        distinctApps: 2,
        currentStreakDays: 0,
        focusHours: 1
      }).workStyle
    ).toBe('Focused Mind');
  });

  it('always returns a non-empty blurb', () => {
    expect(deriveWorkStyle(base).workStyleBlurb.length).toBeGreaterThan(0);
  });
});
