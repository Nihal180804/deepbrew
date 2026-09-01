import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { formatClock } from '@shared/timer/format.js';
import { useTimer } from './lib/useTimer.js';
import { useSettings } from './lib/useSettings.js';

/**
 * The always-on-top floating mini timer (like the Windows Clock timer's pinned
 * view). Shows the live countdown + phase, is draggable anywhere, and reveals
 * pause/resume + unpin controls on hover.
 */
function Pin() {
  const { snapshot, remainingMs, send } = useTimer();
  useSettings(); // keep theme in sync

  const status = snapshot?.status ?? 'idle';
  const phase = snapshot?.phase ?? 'work';
  const isLong = snapshot?.isLongBreak ?? false;
  const running = status === 'running';
  const paused = status === 'paused';

  const label =
    status === 'idle'
      ? 'Ready'
      : phase === 'work'
        ? 'Focus'
        : isLong
          ? 'Long break'
          : 'Break';

  return (
    <div className={`pin ${phase} ${status}`}>
      <div className="pin-main">
        <span className={`pin-dot ${phase}`} />
        <div className="pin-text">
          <div className="pin-clock">{formatClock(remainingMs)}</div>
          <div className="pin-label">{label}</div>
        </div>
      </div>
      <div className="pin-controls">
        {running ? (
          <button title="Pause" aria-label="Pause" onClick={() => send({ type: 'pause' })}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <rect x="2" y="1.5" width="3" height="9" rx="1" />
              <rect x="7" y="1.5" width="3" height="9" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            title={paused ? 'Resume' : 'Start'}
            aria-label={paused ? 'Resume' : 'Start'}
            onClick={() => send(paused ? { type: 'resume' } : { type: 'start' })}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M3 1.5l7 4.5-7 4.5z" />
            </svg>
          </button>
        )}
        <button
          className="pin-close"
          title="Unpin"
          aria-label="Unpin"
          onClick={() => void window.kofe.togglePin()}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pin />
  </StrictMode>
);
