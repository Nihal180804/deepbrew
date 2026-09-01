/**
 * Derives a human "work style" label + blurb from a user's session patterns.
 * Pure and dependency-free so it can be unit-tested and reused. The rules are
 * ordered by specificity; the first match wins.
 */

export interface WorkStyleInput {
  focusHours: number;
  completedSessions: number;
  abandonedSessions: number;
  /** Average length of completed focus sessions, in minutes. */
  avgCompletedMinutes: number;
  /** Distinct focused apps seen in the range (0 if tracking is off). */
  distinctApps: number;
  currentStreakDays: number;
  /** Number of days the range spans (1 = today, 7 = this week). */
  rangeDays: number;
}

export interface WorkStyle {
  workStyle: string;
  workStyleBlurb: string;
}

export function deriveWorkStyle(i: WorkStyleInput): WorkStyle {
  const total = i.completedSessions + i.abandonedSessions;
  const completionRate = total > 0 ? i.completedSessions / total : 0;
  const marathonThreshold = i.rangeDays >= 7 ? 12 : 4;

  if (i.completedSessions === 0 && i.focusHours < 0.1) {
    return {
      workStyle: 'Fresh Cup',
      workStyleBlurb: 'Your focus story starts with the next session.'
    };
  }

  if (i.avgCompletedMinutes >= 40 && completionRate >= 0.7) {
    return {
      workStyle: 'Deep Diver',
      workStyleBlurb: 'Long, uninterrupted dives into the work that matters.'
    };
  }

  if (i.avgCompletedMinutes > 0 && i.avgCompletedMinutes <= 18 && i.completedSessions >= 4) {
    return {
      workStyle: 'Sprinter',
      workStyleBlurb: 'Short, sharp bursts of focus that add up fast.'
    };
  }

  if (i.focusHours >= marathonThreshold) {
    return {
      workStyle: 'Marathoner',
      workStyleBlurb: 'Hours in the chair — you go the distance.'
    };
  }

  if (i.currentStreakDays >= 3) {
    return {
      workStyle: 'Steady Brewer',
      workStyleBlurb: 'Consistency is your superpower — day after day.'
    };
  }

  if (i.distinctApps >= 5) {
    return {
      workStyle: 'Context Shifter',
      workStyleBlurb: 'You move fluidly across many tools and tasks.'
    };
  }

  if (completionRate < 0.5 && total >= 3) {
    return {
      workStyle: 'Restless Starter',
      workStyleBlurb: 'Plenty of starts — finishing is the next frontier.'
    };
  }

  return {
    workStyle: 'Focused Mind',
    workStyleBlurb: 'Calm, deliberate focus, one session at a time.'
  };
}
