import { app } from 'electron';
import { getDb } from './db/database.js';

/**
 * Real application icons, extracted locally.
 *
 * When an app is sampled during a focus session we pull its icon straight from
 * the executable via Electron's `app.getFileIcon` (an OS call — nothing leaves
 * the machine) and cache it as a small PNG data-URL keyed by the app name, so
 * the dashboard's "Top Activity" can show the genuine icon instead of initials.
 */

// Names we've already handled this run (cached or failed) — avoids re-hitting
// the OS icon API every sample tick.
const attempted = new Set<string>();

function hasIcon(name: string): boolean {
  const row = getDb().prepare('SELECT 1 FROM app_icons WHERE app_name = ?').get(name);
  return !!row;
}

function storeIcon(name: string, dataUrl: string): void {
  getDb()
    .prepare(
      `INSERT INTO app_icons (app_name, data_url, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(app_name) DO UPDATE SET data_url = excluded.data_url, updated_at = excluded.updated_at`
    )
    .run(name, dataUrl, Date.now());
}

/**
 * Ensure we have an icon cached for `name`. Cheap no-op once we've handled the
 * app; safe to call on every sample. Fire-and-forget (never throws).
 */
export async function cacheAppIcon(name: string, path: string | null): Promise<void> {
  if (!path || attempted.has(name)) return;
  attempted.add(name);
  try {
    if (hasIcon(name)) return;
    const image = await app.getFileIcon(path, { size: 'normal' });
    if (image.isEmpty()) return;
    // 32px is plenty for the chips; keep the data-URL small.
    const resized = image.resize({ width: 32, height: 32, quality: 'good' });
    storeIcon(name, resized.toDataURL());
  } catch {
    /* icon extraction is best-effort; fall back to initials */
  }
}
