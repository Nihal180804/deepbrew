import { describe, it, expect } from 'vitest';
import { computeStreaks, localDayKey } from '../src/shared/streaks.js';

// Fixed "today" for determinism: 2026-08-31 12:00 local.
const TODAY = new Date(2026, 7, 31, 12, 0, 0).getTime();
const dayBefore = (n: number) => {
  const d = new Date(2026, 7, 31);
  d.setDate(d.getDate() - n);
  return localDayKey(d.getTime());
};

describe('computeStreaks', () => {
  it('returns zero for no active days', () => {
    expect(computeStreaks([], TODAY)).toEqual({ current: 0, longest: 0 });
  });

  it('counts a current streak ending today', () => {
    const days = [dayBefore(0), dayBefore(1), dayBefore(2)];
    expect(computeStreaks(days, TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it('keeps the current streak alive if today has no session yet', () => {
    // Active yesterday and the day before, but not today.
    const days = [dayBefore(1), dayBefore(2)];
    expect(computeStreaks(days, TODAY).current).toBe(2);
  });

  it('breaks the current streak after a missed day', () => {
    // Active today, then a gap, then a block earlier.
    const days = [dayBefore(0), dayBefore(2), dayBefore(3), dayBefore(4)];
    const { current, longest } = computeStreaks(days, TODAY);
    expect(current).toBe(1); // only today is contiguous
    expect(longest).toBe(3); // the 3-day block earlier
  });

  it('is order-independent and dedupes', () => {
    const days = [dayBefore(2), dayBefore(0), dayBefore(0), dayBefore(1)];
    expect(computeStreaks(days, TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it('current streak is 0 when the most recent activity is 2+ days ago', () => {
    const days = [dayBefore(3), dayBefore(4)];
    expect(computeStreaks(days, TODAY).current).toBe(0);
  });
});
