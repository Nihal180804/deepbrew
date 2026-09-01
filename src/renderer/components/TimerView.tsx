import { formatClock, formatDuration } from '@shared/timer/format.js';
import { useTimer } from '../lib/useTimer.js';
import { useStats } from '../lib/useStats.js';
import { Illustration, illustrationFor } from './Illustration.js';
import { Sparkline } from './Sparkline.js';
import { AppChip } from './AppChip.js';

interface Props {
  onOpenPersona: () => void;
}

export function TimerView({ onOpenPersona }: Props) {
  const { snapshot, remainingMs, send } = useTimer();
  const { stats } = useStats();

  const status = snapshot?.status ?? 'idle';
  const phase = snapshot?.phase ?? 'work';
  const isLong = snapshot?.isLongBreak ?? false;
  const running = status === 'running';
  const paused = status === 'paused';
  const active = running || paused;

  const stateLabel =
    status === 'idle'
      ? 'Ready'
      : phase === 'work'
        ? 'Focusing'
        : isLong
          ? 'Long break'
          : 'Short break';
  const caption =
    status === 'idle'
      ? 'A clean block is waiting for you.'
      : status === 'paused'
        ? 'Paused — resume when ready.'
        : phase === 'work'
          ? 'In the zone. Stay with it.'
          : 'Step away and recharge.';

  const primary = running
    ? { label: 'Pause', cmd: { type: 'pause' as const } }
    : paused
      ? { label: 'Resume', cmd: { type: 'resume' as const } }
      : { label: phase === 'work' ? 'Start Focus' : 'Start Break', cmd: { type: 'start' as const } };

  const secondary =
    phase === 'work'
      ? { label: 'Take Break', cmd: { type: 'start' as const, phase: 'break' as const } }
      : { label: 'Skip Break', cmd: { type: 'skip' as const } };

  const kind = illustrationFor(status, phase, isLong);
  const last7 = stats?.daily.slice(-7) ?? [];
  const todaySessions = stats?.daily.at(-1)?.completedSessions ?? 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Deepbrew</h1>
          <p className="sub">{caption}</p>
        </div>
        <button className="pill-btn" onClick={onOpenPersona}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 21v-9h13v3a6 6 0 0 1-6 6H4zM17 13h1.5a2.5 2.5 0 0 1 0 5H17M7 8c1-1 1-2 0-3M11 8c1-1 1-2 0-3" />
          </svg>
          Focus Persona
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </button>
      </div>

      <div className="timer-card">
        <div className="timer-main">
          <div className="timer-clock">{formatClock(remainingMs)}</div>
          <div className="timer-state">{stateLabel}</div>
          <p className="timer-caption">{caption}</p>
          <button className="btn timer-primary" onClick={() => send(primary.cmd)}>
            {primary.label}
          </button>
          <div className="timer-secondary">
            <button className="btn ghost" onClick={() => send(secondary.cmd)}>
              {secondary.label}
            </button>
            {active && (
              <>
                <button className="btn ghost" onClick={() => send({ type: 'extend', minutes: 5 })}>
                  +5 min
                </button>
                <button className="btn ghost" onClick={() => send({ type: 'stop' })}>
                  Stop
                </button>
              </>
            )}
          </div>
        </div>
        <div className={`timer-illo ${phase} ${status}`}>
          <Illustration kind={kind} size={236} />
        </div>
      </div>

      <div className="quick-grid">
        <div className="stat-card">
          <div className="label">Today</div>
          <div className="value">{stats ? formatDuration(stats.todayFocusMs) : '—'}</div>
          <div className="stat-sub">{todaySessions} sessions</div>
        </div>
        <div className="stat-card">
          <div className="label">Streak</div>
          <div className="value">
            {stats?.currentStreakDays ?? 0}
            <span className="unit">days</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Last 7 days</div>
          <Sparkline days={last7} />
        </div>
        <div className="stat-card">
          <div className="label">Top activity</div>
          <div className="chip-row">
            {(stats?.topApps ?? []).slice(0, 5).map((a) => (
              <AppChip key={a.appName} name={a.appName} />
            ))}
            {(!stats || stats.topApps.length === 0) && <span className="stat-sub">No data yet</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
