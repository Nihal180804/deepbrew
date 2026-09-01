/**
 * Pure streak math over a set of active local-day strings (YYYY-MM-DD).
 * Kept dependency-free (no DB, no electron) so it is directly unit-testable
 * and reusable by both the analytics store and the renderer if needed.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function localDayKey(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param activeDays  unique-or-not list of YYYY-MM-DD strings with activity
 * @param todayMs     "now" as epoch ms (injectable for tests)
 */
export function computeStreaks(
  activeDays: string[],
  todayMs: number = Date.now()
): { current: number; longest: number } {
  const daySet = new Set(activeDays);
  if (daySet.size === 0) return { current: 0, longest: 0 };

  const sorted = [...daySet].sort();

  // Longest run of consecutive calendar days.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = Date.parse(sorted[i - 1] + 'T00:00:00');
    const cur = Date.parse(sorted[i] + 'T00:00:00');
    const diff = Math.round((cur - prev) / DAY_MS);
    run = diff === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // Current streak: count backwards from today. If today has no activity yet,
  // the streak can still be alive up to yesterday.
  const cursor = new Date(todayMs);
  cursor.setHours(0, 0, 0, 0);
  if (!daySet.has(localDayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let current = 0;
  while (daySet.has(localDayKey(cursor.getTime()))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, longest };
}
