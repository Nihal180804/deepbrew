import { StrictMode, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { formatClock } from '@shared/timer/format.js';
import { useTimer } from './lib/useTimer.js';
import { useSettings } from './lib/useSettings.js';

/**
 * Always-on-top floating mini timer (like the Windows Clock timer's pinned
 * view). Drag it anywhere with the mouse; double-click snaps it to the nearest
 * corner. Controls (pause/resume, unpin) sit on the right.
 *
 * Dragging is done manually (pointer capture + a fire-and-forget move IPC)
 * rather than `-webkit-app-region`, which is unreliable on transparent windows.
 */
function Pin() {
  const { snapshot, remainingMs, send } = useTimer();
  useSettings();

  const dragging = useRef(false);
  const acc = useRef({ dx: 0, dy: 0 });
  const raf = useRef(0);

  const flush = () => {
    raf.current = 0;
    const { dx, dy } = acc.current;
    acc.current = { dx: 0, dy: 0 };
    if (dx || dy) window.kofe.pinMoveBy(dx, dy);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.pin-controls')) return; // let buttons click
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    document.body.classList.add('pin-dragging');
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    acc.current.dx += e.movementX;
    acc.current.dy += e.movementY;
    if (!raf.current) raf.current = requestAnimationFrame(flush);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    document.body.classList.remove('pin-dragging');
  };

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
    <div
      className={`pin ${phase} ${status}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={() => window.kofe.pinSnap()}
      title="Drag to move · double-click to snap to a corner"
    >
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
            <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
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
            <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
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
          <svg width="13" height="13" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" aria-hidden>
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
