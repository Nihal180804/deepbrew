import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { formatClock, formatDuration } from '@shared/timer/format.js';
import { useTimer } from './lib/useTimer.js';
import { useSettings } from './lib/useSettings.js';
import { useStats } from './lib/useStats.js';
import { Illustration, illustrationFor } from './components/Illustration.js';

function Popover() {
  const { snapshot, remainingMs, send } = useTimer();
  const { settings } = useSettings();
  const { stats } = useStats();

  const status = snapshot?.status ?? 'idle';
  const phase = snapshot?.phase ?? 'work';
  const isLong = snapshot?.isLongBreak ?? false;
  const running = status === 'running';
  const paused = status === 'paused';
  const active = running || paused;

  const stateLabel =
    status === 'idle'
      ? phase === 'work'
        ? 'Ready'
        : isLong
          ? 'Long Break'
          : 'Short Break'
      : phase === 'work'
        ? 'Focus'
        : isLong
          ? 'Long Break'
          : 'Short Break';

  const caption = captionFor(status, phase, isLong);

  const primary = running
    ? { label: 'Pause', cmd: { type: 'pause' as const } }
    : paused
      ? { label: 'Resume', cmd: { type: 'resume' as const } }
      : {
          label: phase === 'work' ? 'Start Focus' : 'Start Break',
          cmd: { type: 'start' as const }
        };

  const kind = illustrationFor(status, phase, isLong);

  // Mini stats.
  const todayFocus = stats ? formatDuration(stats.todayFocusMs) : '—';
  const todaySessions = stats?.daily.at(-1)?.completedSessions ?? 0;
  const streak = stats?.currentStreakDays ?? 0;
  const n = settings?.sessionsBeforeLongBreak ?? 0;
  const cycles = snapshot?.workCyclesCompleted ?? 0;
  const sessionsLeft = n > 0 ? n - (cycles % n) : null;

  return (
    <div className="pop">
      <div className="pop-top">
        <div className="pop-head">
          <span className="pop-state">{stateLabel}</span>
          <span className="pop-clock">{formatClock(remainingMs)}</span>
        </div>
        <div className="pop-top-actions">
          <button
            className="pop-gear"
            title="Pin timer on top"
            aria-label="Pin timer on top"
            onClick={() => void window.kofe.togglePin()}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 14v7" />
            </svg>
          </button>
          <button
            className="pop-gear"
            title="Settings"
            aria-label="Settings"
            onClick={() => void window.kofe.openDashboard('settings')}
          >
            ⚙
          </button>
        </div>
      </div>

      <div className={`pop-illo ${phase} ${status}`}>
        <Illustration kind={kind} size={176} />
      </div>

      <p className="pop-caption">{caption}</p>

      <button className="pop-primary" onClick={() => send(primary.cmd)}>
        {primary.label}
      </button>

      <div className="pop-actions">
        <button disabled={!active} onClick={() => send({ type: 'skip' })}>
          {phase === 'break' ? 'Skip Break' : 'Skip'}
        </button>
        <button disabled={!active} onClick={() => send({ type: 'extend', minutes: 5 })}>
          +5 min
        </button>
        <button disabled={status === 'idle'} onClick={() => send({ type: 'reset' })}>
          Reset
        </button>
        <button disabled={!active} onClick={() => send({ type: 'stop' })}>
          Stop
        </button>
      </div>

      <div className="pop-stats">
        <Stat label="Today" value={todayFocus} sub={`${todaySessions} sessions`} />
        <Stat label="Streak" value={String(streak)} sub="days" />
        <Stat
          label="Long"
          value={sessionsLeft === null ? '—' : String(sessionsLeft)}
          sub={sessionsLeft === null ? 'off' : 'sessions left'}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="pop-stat">
      <div className="pop-stat-label">{label}</div>
      <div className="pop-stat-value">{value}</div>
      <div className="pop-stat-sub">{sub}</div>
    </div>
  );
}

function captionFor(status: string, phase: string, isLong: boolean): string {
  if (status === 'idle') {
    return phase === 'work' ? 'A clean block is waiting.' : 'Ready when you are.';
  }
  if (status === 'paused') return 'Paused — resume when ready.';
  if (phase === 'break') return isLong ? 'Enjoy a longer break.' : 'Take a short break.';
  return 'In the zone — stay with it.';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popover />
  </StrictMode>
);
