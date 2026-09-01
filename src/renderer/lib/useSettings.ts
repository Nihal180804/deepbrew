import { useEffect, useState } from 'react';
import type { Settings } from '@shared/types.js';

/** Applies the theme preference to <html data-theme>. */
export function applyTheme(theme: Settings['theme']): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/** Loads settings and keeps them in sync with main-process changes. */
export function useSettings(): {
  settings: Settings | null;
  update: (patch: Partial<Settings>) => Promise<void>;
} {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let mounted = true;
    void window.kofe.getSettings().then((s) => {
      if (!mounted) return;
      setSettings(s);
      applyTheme(s.theme);
    });
    const off = window.kofe.onSettingsChanged((s) => {
      setSettings(s);
      applyTheme(s.theme);
    });
    return () => {
      mounted = false;
      off();
    };
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = await window.kofe.updateSettings(patch);
    setSettings(next);
    applyTheme(next.theme);
  };

  return { settings, update };
}
