import { useState } from 'react';
import { formatHours, formatDuration } from '@shared/timer/format.js';
import { useStats } from '../lib/useStats.js';
import { StreakCalendar } from './StreakCalendar.js';
import { SessionHistory } from './SessionHistory.js';
import { AppChip } from './AppChip.js';

export function StatsView() {
  const { stats, sessions } = useStats();
  const [range, setRange] = useState<7 | 30>(7);

  if (!stats) return <div className="page"><p className="empty">Loading…</p></div>;

  const daily = stats.daily.slice(-range);
  const maxFocus = Math.max(1, ...daily.map((d) => d.focusMs));
  const rangeFocusMs = daily.reduce((sum, d) => sum + d.focusMs, 0);
  const rangeSessions = daily.reduce((sum, d) => sum + d.completedSessions, 0);
  const totalAppMs = Math.max(1, stats.topApps.reduce((sum, a) => sum + a.focusMs, 0));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Focus Analytics</h1>
          <p className="sub">Local patterns, session rhythm, and app split.</p>
        </div>
        <div className="seg">
          <button className={range === 7 ? 'active' : ''} onClick={() => setRange(7)}>7D</button>
          <button className={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>30D</button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Focus time" value={formatHours(rangeFocusMs / 3600000)} sub={`${range} days`} />
        <StatCard label="Sessions" value={String(rangeSessions)} sub="focus blocks" />
        <StatCard label="Streak" value={String(stats.currentStreakDays)} sub={`longest ${stats.longestStreakDays}`} />
        <div className="stat-card">
          <div className="label">Top activity</div>
          <div className="chip-row" style={{ marginTop: 8 }}>
            {stats.topApps.slice(0, 5).map((a) => (
              <AppChip key={a.appName} name={a.appName} iconUrl={a.iconDataUrl} />
            ))}
            {stats.topApps.length === 0 && <span className="stat-sub">No data</span>}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Focused Time</h2>
          <span className="panel-note">{formatDuration(rangeFocusMs)} across {range} days · daily</span>
        </div>
        <div className="bars">
          {daily.map((d) => (
            <div className="bar-col" key={d.day}>
              <div
                className="bar"
                style={{ height: `${(d.focusMs / maxFocus) * 100}%` }}
                title={`${d.day}: ${formatDuration(d.focusMs)}`}
              />
              <div className="bar-label">{d.day.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="split-grid">
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

        <div className="panel">
          <div className="panel-head">
            <h2>Streak Calendar</h2>
            <span className="panel-note">{stats.activeDays.length} active days</span>
          </div>
          <StreakCalendar activeDays={stats.activeDays} weeks={16} />
        </div>
      </div>

      <SessionHistory sessions={sessions.slice(0, 30)} embedded />
    </div>
  );
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
