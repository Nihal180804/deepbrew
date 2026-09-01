import { StrictMode, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { formatClock } from '@shared/timer/format.js';
import { PIN_SIZE_ORDER, type PinSize } from '@shared/types.js';
import { useTimer } from './lib/useTimer.js';
import { useSettings } from './lib/useSettings.js';
import { Illustration, illustrationFor } from './components/Illustration.js';

/**
 * Always-on-top floating mini timer. Drag it anywhere (manual pointer drag via
 * screen-coordinate deltas — reliable on transparent windows), double-click to
 * snap to a corner, and cycle through size presets (compact / medium / large;
 * medium & large show the avatar).
 */
function Pin() {
  const { snapshot, remainingMs, send } = useTimer();
  const { settings, update } = useSettings();

  const size: PinSize = settings?.pinSize ?? 'compact';
  const last = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.pin-controls')) return; // let buttons click
    dragging.current = true;
    last.current = { x: e.screenX, y: e.screenY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    document.body.classList.add('pin-dragging');
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.screenX - last.current.x;
    const dy = e.screenY - last.current.y;
    if (dx || dy) {
      last.current = { x: e.screenX, y: e.screenY };
      window.kofe.pinMoveBy(dx, dy);
    }
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

  const cycleSize = () => {
    const next = PIN_SIZE_ORDER[(PIN_SIZE_ORDER.indexOf(size) + 1) % PIN_SIZE_ORDER.length];
    void update({ pinSize: next });
  };

  const status = snapshot?.status ?? 'idle';
  const phase = snapshot?.phase ?? 'work';
  const isLong = snapshot?.isLongBreak ?? false;
  const running = status === 'running';
  const paused = status === 'paused';

  const label =
    status === 'idle' ? 'Ready' : phase === 'work' ? 'Focus' : isLong ? 'Long break' : 'Break';
  const kind = illustrationFor(status, phase, isLong);
  const showAvatar = size !== 'compact';
  const avatarSize = size === 'large' ? 112 : 60;

  const controls = (
    <div className="pin-controls">
      <button title="Resize" aria-label="Resize" onClick={cycleSize}>
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 1.5h3.5V5M5 10.5H1.5V7M10.5 1.5l-4 4M1.5 10.5l4-4" />
        </svg>
      </button>
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
      <button className="pin-close" title="Unpin" aria-label="Unpin" onClick={() => void window.kofe.togglePin()}>
        <svg width="13" height="13" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M2 2l8 8M10 2l-8 8" />
        </svg>
      </button>
    </div>
  );

  const clockBlock = (
    <div className="pin-text">
      <div className="pin-clock">{formatClock(remainingMs)}</div>
      <div className="pin-label">{label}</div>
    </div>
  );

  const avatar = showAvatar && (
    <div className={`pin-illo ${phase}`}>
      <Illustration kind={kind} size={avatarSize} />
    </div>
  );

  return (
    <div
      className={`pin ${size} ${phase} ${status}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={() => window.kofe.pinSnap()}
      title="Drag to move · double-click to snap to a corner"
    >
      {size === 'large' ? (
        <>
          {avatar}
          {clockBlock}
          {controls}
        </>
      ) : (
        <>
          <div className="pin-main">
            {showAvatar ? avatar : <span className={`pin-dot ${phase}`} />}
            {clockBlock}
          </div>
          {controls}
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pin />
  </StrictMode>
);
