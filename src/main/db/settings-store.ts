import { getDb } from './database.js';
import { DEFAULT_SETTINGS, type Settings } from '@shared/types.js';

/**
 * Settings persistence. Stored as a single JSON blob under a well-known key so
 * adding new fields never needs a schema migration; unknown/missing fields fall
 * back to defaults (deep-merged for nested objects like `shortcuts`).
 */

const KEY = 'app-settings';

export function loadSettings(): Settings {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(KEY) as
    | { value: string }
    | undefined;
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(row.value) as Partial<Settings>;
    return mergeSettings(DEFAULT_SETTINGS, parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(KEY, JSON.stringify(settings));
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = mergeSettings(loadSettings(), patch);
  saveSettings(next);
  return next;
}

function mergeSettings(base: Settings, patch: Partial<Settings>): Settings {
  return {
    ...base,
    ...patch,
    shortcuts: { ...base.shortcuts, ...(patch.shortcuts ?? {}) }
  };
}
