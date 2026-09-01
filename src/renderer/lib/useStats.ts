import { useCallback, useEffect, useState } from 'react';
import type { StatsSummary, SessionRecord } from '@shared/types.js';

/** Loads stats + recent sessions and refreshes when main signals a change. */
export function useStats(): {
  stats: StatsSummary | null;
  sessions: SessionRecord[];
  reload: () => void;
} {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  const reload = useCallback(() => {
    void window.kofe.getStats(30).then(setStats);
    void window.kofe.getSessions(100).then(setSessions);
  }, []);

  useEffect(() => {
    reload();
    const off = window.kofe.onStatsInvalidated(reload);
    return off;
  }, [reload]);

  return { stats, sessions, reload };
}
