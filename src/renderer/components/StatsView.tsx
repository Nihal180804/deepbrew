import { useState } from 'react';
import { formatDuration } from '@shared/timer/format.js';
import { useStats } from '../lib/useStats.js';
import { StreakCalendar } from './StreakCalendar.js';
import { SessionHistory } from './SessionHistory.js';
import { AppChip } from './AppChip.js';

type Range = 1 | 7 | 30;

export function StatsView() {
  const { stats, sessions } = useStats();
  const [range, setRange] = useState<Range>(7);

  if (!stats) return <div className="page"><p className="empty">Loading…</p></div>;

  const daily = stats.daily.slice(-range);
  const maxFocus = Math.max(1, ...daily.map((d) => d.focusMs));
  const rangeFocusMs = daily.reduce((sum, d) => sum + d.focusMs, 0);
  const rangeSessions = daily.reduce((sum, d) => sum + d.completedSessions, 0);
  const totalAppMs = Math.max(1, stats.topApps.reduce((sum, a) => sum + a.focusMs, 0));
  const topApp = stats.topApps[0] ?? null;
  const rangeLabel = range === 1 ? 'Today' : `${range} days`;

  // Bar-chart y-axis: round the max up to a whole hour with a little headroom,
  // then lay out ~5 evenly-spaced ticks (0m, 1h, 2h, …).
  const niceMaxHours = Math.max(1, Math.floor(maxFocus / 3_600_000) + 1);
  const niceMaxMs = niceMaxHours * 3_600_000;
  const step = Math.max(1, Math.ceil(niceMaxHours / 5));
  const ticks: number[] = [];
  for (let h = 0; h <= niceMaxHours; h += step) ticks.push(h);
  if (ticks[ticks.length - 1] !== niceMaxHours) ticks.push(niceMaxHours);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Focus Analytics</h1>
          <p className="sub">Local patterns, session rhythm, and app split.</p>
        </div>
        <div className="seg">
          <button className={range === 1 ? 'active' : ''} onClick={() => setRange(1)}>Today</button>
          <button className={range === 7 ? 'active' : ''} onClick={() => setRange(7)}>7 Days</button>
          <button className={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>30 Days</button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Focus time" value={fmtHrs(rangeFocusMs)} sub={rangeLabel} />
        <StatCard label="Sessions" value={String(rangeSessions)} sub="focus blocks" />
        <StatCard label="Streak" value={String(stats.currentStreakDays)} sub="days" />
        <StatCard
          label="Top app"
          value={topApp ? topApp.appName : '—'}
          sub={topApp ? formatDuration(topApp.focusMs) : 'no data'}
        />
      </div>

      <div className="stats-split">
        <div className="panel">
          <div className="panel-head">
            <h2>Focused Time</h2>
            <span className="panel-note">{fmtHrs(rangeFocusMs)} across {rangeLabel.toLowerCase()}</span>
          </div>
          <div className="chart-plot">
            <div className="bars">
              {ticks.map((h) => (
                <div className="grid-line" key={h} style={{ bottom: `${(h / niceMaxHours) * 100}%` }}>
                  <span className="grid-label">{h === 0 ? '0m' : `${h}h`}</span>
                </div>
              ))}
              {daily.map((d) => (
                <div className="bar-col" key={d.day}>
                  <div
                    className="bar"
                    style={{ height: `${(d.focusMs / niceMaxMs) * 100}%` }}
                    title={`${d.day}: ${formatDuration(d.focusMs)}`}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="bars-x">
            {daily.map((d) => (
              <span className="x-label" key={d.day}>{dayLabel(d.day, range)}</span>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>App Split</h2>
            <span className="panel-note">tracked apps</span>
          </div>
          {stats.topApps.length === 0 ? (
            <p className="empty">
              Enable active-app tracking in Settings to see which apps you focus in.
            </p>
          ) : (
            <div className="applist">
              {stats.topApps.map((a) => (
                <div className="app-row" key={a.appName}>
                  <AppChip name={a.appName} iconUrl={a.iconDataUrl} size={28} />
                  <div className="app-meta">
                    <div className="app-name">{a.appName}</div>
                    <div className="app-bar-track">
                      <div className="app-bar" style={{ width: `${(a.focusMs / totalAppMs) * 100}%` }} />
                    </div>
                  </div>
                  <div className="app-time">{formatDuration(a.focusMs)}</div>
                  <div className="app-pct">{Math.round((a.focusMs / totalAppMs) * 100)}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Streak Calendar</h2>
          <span className="panel-note">{stats.activeDays.length} active days</span>
        </div>
        <StreakCalendar activeDays={stats.activeDays} weeks={16} />
      </div>

      <SessionHistory sessions={sessions.slice(0, 30)} embedded />
    </div>
  );
}

/** Whole hours without a trailing ".0" (e.g. "8h", "3.2h"). */
function fmtHrs(ms: number): string {
  const h = Math.round((ms / 3_600_000) * 10) / 10;
  return `${h}h`;
}

/** X-axis label: weekday initial for short ranges, day-of-month for 30 days. */
function dayLabel(day: string, range: Range): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (range <= 7) return date.toLocaleDateString(undefined, { weekday: 'narrow' });
  return String(d); // day of month for the 30-day view
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
