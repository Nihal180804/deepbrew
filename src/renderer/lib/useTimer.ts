import { useEffect, useRef, useState } from 'react';
import type { TimerSnapshot } from '@shared/types.js';
import type { TimerCommand } from '@shared/ipc-contract.js';

/**
 * Subscribes to authoritative snapshots from main, then interpolates the
 * remaining time locally (4x/sec) so the countdown looks smooth without
 * hammering IPC. Main remains the source of truth for state transitions.
 */
export function useTimer(): {
  snapshot: TimerSnapshot | null;
  remainingMs: number;
  progress: number;
  send: (cmd: TimerCommand) => void;
} {
  const [snapshot, setSnapshot] = useState<TimerSnapshot | null>(null);
  const [, force] = useState(0);
  const snapRef = useRef<TimerSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;
    void window.kofe.getTimer().then((s) => {
      if (!mounted) return;
      snapRef.current = s;
      setSnapshot(s);
    });
    const off = window.kofe.onTimerUpdate((s) => {
      snapRef.current = s;
      setSnapshot(s);
    });
    return () => {
      mounted = false;
      off();
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (snapRef.current?.status === 'running') force((n) => n + 1);
    }, 250);
    return () => clearInterval(id);
  }, []);

  const remainingMs = computeRemaining(snapshot);
  const progress = computeProgress(snapshot, remainingMs);

  return {
    snapshot,
    remainingMs,
    progress,
    send: (cmd) => {
      void window.kofe.sendCommand(cmd).then((s) => {
        snapRef.current = s;
        setSnapshot(s);
      });
    }
  };
}

function computeRemaining(s: TimerSnapshot | null): number {
  if (!s) return 0;
  if (s.status === 'running') {
    const elapsedSinceSnap = Date.now() - s.at;
    return Math.max(0, s.remainingMs - elapsedSinceSnap);
  }
  return Math.max(0, s.remainingMs);
}

function computeProgress(s: TimerSnapshot | null, remainingMs: number): number {
  if (!s || s.totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, (s.totalMs - remainingMs) / s.totalMs));
}
