interface Props {
  activeDays: string[]; // YYYY-MM-DD
  weeks?: number;
}

/** A GitHub-style contribution grid of the last N weeks of active focus days. */
export function StreakCalendar({ activeDays, weeks = 18 }: Props) {
  const set = new Set(activeDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toKey(today);

  const days = weeks * 7;
  const cells: Array<{ key: string; active: boolean; isToday: boolean }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toKey(d);
    cells.push({ key, active: set.has(key), isToday: key === todayStr });
  }

  return (
    <div className="calendar" style={{ gridTemplateColumns: `repeat(${weeks}, 16px)`, gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 16px)' }}>
      {cells.map((c) => (
        <div
          key={c.key}
          className={`cal-cell ${c.active ? 'active' : ''} ${c.isToday ? 'today' : ''}`}
          title={c.key}
        />
      ))}
    </div>
  );
}

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
