import { formatDuration } from '@shared/timer/format.js';
import type { DailyStat } from '@shared/types.js';

/** Compact 7-bar sparkline of daily focus, with M/T/W… day initials. */
export function Sparkline({ days }: { days: DailyStat[] }) {
  const max = Math.max(1, ...days.map((d) => d.focusMs));
  return (
    <div className="spark">
      {days.map((d) => (
        <div className="spark-col" key={d.day} title={`${d.day}: ${formatDuration(d.focusMs)}`}>
          <div className="spark-bar" style={{ height: `${Math.max(6, (d.focusMs / max) * 100)}%` }} />
          <span className="spark-label">{dayInitial(d.day)}</span>
        </div>
      ))}
    </div>
  );
}

function dayInitial(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
}
