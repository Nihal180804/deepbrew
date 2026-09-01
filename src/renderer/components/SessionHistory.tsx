import { formatDuration } from '@shared/timer/format.js';
import type { SessionRecord } from '@shared/types.js';

interface Props {
  sessions: SessionRecord[];
  /** When embedded in another view, render just the panel (no page title). */
  embedded?: boolean;
}

export function SessionHistory({ sessions, embedded }: Props) {
  const body = (
    <div className="panel">
      {embedded && (
        <div className="panel-head">
          <h2>Session History</h2>
          <span className="panel-note">most recent</span>
        </div>
      )}
      {sessions.length === 0 ? (
        <p className="empty">No sessions yet. Start a focus session from the tray to begin.</p>
      ) : (
        <div className="history">
          {sessions.map((s) => (
            <div className="history-row" key={s.id}>
              <span className="when">{formatWhen(s.startedAt)}</span>
              <span>
                {s.phase === 'work' ? 'Focus' : 'Break'}
                {s.appName ? ` · ${s.appName}` : ''}
              </span>
              <strong>{formatDuration(s.actualMs)}</strong>
              <span className={`badge ${s.completed ? 'completed' : 'abandoned'}`}>
                {s.completed ? 'Completed' : 'Stopped'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <div>
      <h1>Session history</h1>
      <p className="sub">Your most recent focus and break sessions.</p>
      {body}
    </div>
  );
}

function formatWhen(epoch: number): string {
  const d = new Date(epoch);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}
