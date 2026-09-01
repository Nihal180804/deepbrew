import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { useSettings } from './lib/useSettings.js';
import { TimerView } from './components/TimerView.js';
import { StatsView } from './components/StatsView.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { PersonaModal } from './components/PersonaModal.js';
import { TitleBar } from './components/TitleBar.js';

type Tab = 'timer' | 'stats' | 'settings';

const ICONS: Record<Tab, JSX.Element> = {
  timer: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13V9M9 2h6" />
    </svg>
  ),
  stats: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h11M18 8h2M4 16h2M9 16h11" />
      <circle cx="16" cy="8" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="7" cy="16" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  )
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'timer', label: 'Timer' },
  { id: 'stats', label: 'Stats' },
  { id: 'settings', label: 'Settings' }
];

function Dashboard() {
  const [tab, setTab] = useState<Tab>(initialTab());
  const { settings, update } = useSettings();
  const [toast, setToast] = useState<string | null>(null);
  const [personaOpen, setPersonaOpen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    const onHash = () => setTab(initialTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (t: Tab) => {
    setTab(t);
    window.location.hash = t;
  };

  return (
    <div className="app">
      <TitleBar />
      <nav className="topnav">
        <div className="topnav-pill">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`topnav-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => go(t.id)}
            >
              <span className="topnav-glyph" aria-hidden>{ICONS[t.id]}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="app-body">
        {tab === 'timer' && <TimerView onOpenPersona={() => setPersonaOpen(true)} />}
        {tab === 'stats' && <StatsView />}
        {tab === 'settings' && (
          <div className="page">
            {settings ? (
              <SettingsPanel settings={settings} update={update} onToast={showToast} />
            ) : (
              <p className="empty">Loading…</p>
            )}
          </div>
        )}
      </main>

      <PersonaModal open={personaOpen} onClose={() => setPersonaOpen(false)} onToast={showToast} />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function initialTab(): Tab {
  const h = window.location.hash.replace('#', '');
  if (h === 'stats' || h === 'settings') return h;
  // Legacy hashes map to the closest new tab.
  if (h === 'history' || h === 'overview') return 'stats';
  if (h === 'card') return 'timer';
  return 'timer';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>
);
