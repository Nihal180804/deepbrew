import { getDb } from './database.js';
import { computeStreaks, localDayKey } from '@shared/streaks.js';
import { deriveWorkStyle } from '@shared/work-style.js';
import type {
  AppStat,
  DailyStat,
  PersonaCardData,
  SessionRecord,
  StatsSummary
} from '@shared/types.js';

/**
 * Analytics queries over the local `sessions` table. All focus stats count
 * *work* phases only. Everything is computed on-device.
 */

export interface NewSession {
  phase: 'work' | 'break';
  startedAt: number;
  endedAt: number;
  plannedMs: number;
  actualMs: number;
  completed: boolean;
  appName: string | null;
}

export function insertSession(s: NewSession): number {
  const info = getDb()
    .prepare(
      `INSERT INTO sessions (phase, started_at, ended_at, planned_ms, actual_ms, completed, app_name)
       VALUES (@phase, @startedAt, @endedAt, @plannedMs, @actualMs, @completed, @appName)`
    )
    .run({ ...s, completed: s.completed ? 1 : 0 });
  return Number(info.lastInsertRowid);
}

function rowToSession(r: any): SessionRecord {
  return {
    id: r.id,
    phase: r.phase,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    plannedMs: r.planned_ms,
    actualMs: r.actual_ms,
    completed: !!r.completed,
    appName: r.app_name ?? null
  };
}

export function getRecentSessions(limit = 100): SessionRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?')
    .all(limit);
  return rows.map(rowToSession);
}

/** Local-time YYYY-MM-DD for an epoch ms value. */
const localDay = localDayKey;

/** Start-of-day epoch ms for a date offset (0 = today) in local time. */
function startOfDay(offsetDays = 0): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDays);
  return d.getTime();
}

function focusBetween(from: number, to: number): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(actual_ms), 0) AS total
       FROM sessions WHERE phase = 'work' AND started_at >= ? AND started_at < ?`
    )
    .get(from, to) as { total: number };
  return row.total;
}

export function getDailyStats(days = 30): DailyStat[] {
  const out: DailyStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const from = startOfDay(i);
    const to = from + 24 * 60 * 60 * 1000;
    const row = getDb()
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN phase='work' THEN actual_ms ELSE 0 END), 0) AS focus,
           SUM(CASE WHEN phase='work' AND completed=1 THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN phase='work' AND completed=0 THEN 1 ELSE 0 END) AS abandoned
         FROM sessions WHERE started_at >= ? AND started_at < ?`
      )
      .get(from, to) as { focus: number; completed: number | null; abandoned: number | null };
    out.push({
      day: localDay(from),
      focusMs: row.focus,
      completedSessions: row.completed ?? 0,
      abandonedSessions: row.abandoned ?? 0
    });
  }
  return out;
}

/** Distinct local days (YYYY-MM-DD) that have at least one completed work session. */
export function getActiveDays(): string[] {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT started_at FROM sessions WHERE phase='work' AND completed=1`
    )
    .all() as Array<{ started_at: number }>;
  const set = new Set<string>();
  for (const r of rows) set.add(localDay(r.started_at));
  return [...set].sort();
}

export function getTopApps(limit = 6, sinceDays = 30): AppStat[] {
  const from = startOfDay(sinceDays - 1);
  const rows = getDb()
    .prepare(
      `SELECT app_name AS appName,
              COALESCE(SUM(actual_ms),0) AS focusMs,
              COUNT(*) AS sessions
       FROM sessions
       WHERE phase='work' AND app_name IS NOT NULL AND started_at >= ?
       GROUP BY app_name ORDER BY focusMs DESC LIMIT ?`
    )
    .all(from, limit) as AppStat[];
  return rows;
}

export function getStatsSummary(days = 30): StatsSummary {
  const now = Date.now();
  const todayStart = startOfDay(0);
  const weekStart = startOfDay(6);
  const monthStart = startOfDay(29);

  const totals = getDb()
    .prepare(
      `SELECT
         SUM(CASE WHEN phase='work' AND completed=1 THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN phase='work' AND completed=0 THEN 1 ELSE 0 END) AS abandoned
       FROM sessions`
    )
    .get() as { completed: number | null; abandoned: number | null };

  const activeDays = getActiveDays();
  const streaks = computeStreaks(activeDays);

  return {
    todayFocusMs: focusBetween(todayStart, now + 1),
    weekFocusMs: focusBetween(weekStart, now + 1),
    monthFocusMs: focusBetween(monthStart, now + 1),
    currentStreakDays: streaks.current,
    longestStreakDays: streaks.longest,
    completedSessions: totals.completed ?? 0,
    abandonedSessions: totals.abandoned ?? 0,
    daily: getDailyStats(days),
    topApps: getTopApps(),
    activeDays
  };
}

export function getPersonaData(range: 'today' | 'week'): PersonaCardData {
  const now = Date.now();
  const rangeDays = range === 'today' ? 1 : 7;
  const from = range === 'today' ? startOfDay(0) : startOfDay(6);
  const focusMs = focusBetween(from, now + 1);

  const counts = getDb()
    .prepare(
      `SELECT
         SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN completed=0 THEN 1 ELSE 0 END) AS abandoned,
         COALESCE(AVG(CASE WHEN completed=1 THEN actual_ms END), 0) AS avgCompletedMs,
         COUNT(DISTINCT app_name) AS distinctApps
       FROM sessions WHERE phase='work' AND started_at >= ?`
    )
    .get(from) as {
    completed: number | null;
    abandoned: number | null;
    avgCompletedMs: number;
    distinctApps: number;
  };

  const topApps = getDb()
    .prepare(
      `SELECT app_name AS appName,
              COALESCE(SUM(actual_ms),0) AS focusMs,
              COUNT(*) AS sessions
       FROM sessions
       WHERE phase='work' AND app_name IS NOT NULL AND started_at >= ?
       GROUP BY app_name ORDER BY focusMs DESC LIMIT 3`
    )
    .all(from) as AppStat[];

  const streaks = computeStreaks(getActiveDays(), now);
  const completedSessions = counts.completed ?? 0;

  const { workStyle, workStyleBlurb } = deriveWorkStyle({
    focusHours: focusMs / 3_600_000,
    completedSessions,
    abandonedSessions: counts.abandoned ?? 0,
    avgCompletedMinutes: counts.avgCompletedMs / 60_000,
    distinctApps: counts.distinctApps ?? 0,
    currentStreakDays: streaks.current,
    rangeDays
  });

  return {
    rangeLabel: range === 'today' ? 'Today' : 'This week',
    focusHours: focusMs / 3_600_000,
    sessionsCompleted: completedSessions,
    currentStreakDays: streaks.current,
    topApps,
    workStyle,
    workStyleBlurb,
    peakLabel: computePeakLabel(from),
    generatedAt: now
  };
}

/** Finds the hour of day with the most focus time and formats it as a label. */
function computePeakLabel(from: number): string | null {
  const rows = getDb()
    .prepare(
      `SELECT started_at AS startedAt, actual_ms AS actualMs
       FROM sessions WHERE phase='work' AND started_at >= ?`
    )
    .all(from) as Array<{ startedAt: number; actualMs: number }>;
  if (rows.length === 0) return null;

  const byHour = new Array<number>(24).fill(0);
  for (const r of rows) byHour[new Date(r.startedAt).getHours()] += r.actualMs;

  let peakHour = 0;
  let peakMs = 0;
  byHour.forEach((ms, h) => {
    if (ms > peakMs) {
      peakMs = ms;
      peakHour = h;
    }
  });
  if (peakMs === 0) return null;

  const suffix = peakHour < 12 ? 'AM' : 'PM';
  const h12 = peakHour % 12 === 0 ? 12 : peakHour % 12;
  return `Peak focus around ${h12} ${suffix}`;
}

export function exportAllData(): { sessions: SessionRecord[] } {
  const rows = getDb().prepare('SELECT * FROM sessions ORDER BY started_at ASC').all();
  return { sessions: rows.map(rowToSession) };
}

export function deleteAllData(): void {
  getDb().prepare('DELETE FROM sessions').run();
}
