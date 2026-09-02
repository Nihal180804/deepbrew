/**
 * Active-application tracking with graceful degradation.
 *
 * Uses the optional `active-win` package. On Wayland (and anywhere the package
 * or its helpers are unavailable) this reports "unsupported" instead of failing,
 * and the dashboard surfaces that state in Settings.
 */

type ActiveWinFn = (opts?: unknown) => Promise<unknown>;
let activeWinFn: ActiveWinFn | null = null;
let loadAttempted = false;
let supported = false;
let note = '';

function isWayland(): boolean {
  return (
    process.platform === 'linux' &&
    (process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY)
  );
}

async function ensureLoaded(): Promise<void> {
  if (loadAttempted) return;
  loadAttempted = true;

  if (isWayland()) {
    supported = false;
    note =
      'Active-app tracking is unavailable on Wayland (the compositor restricts window inspection). It works on X11 sessions.';
    return;
  }

  try {
    // active-win is an optional dependency; import lazily so a missing/native
    // build never breaks app startup. v8 exports a callable default.
    const mod = (await import('active-win')) as unknown as {
      default?: ActiveWinFn;
    } & ActiveWinFn;
    activeWinFn = (mod.default ?? mod) as ActiveWinFn;
    supported = typeof activeWinFn === 'function';
  } catch {
    supported = false;
    note =
      'Active-app tracking is unavailable (the active-win helper could not be loaded on this system).';
  }
}

export async function isActiveWindowSupported(): Promise<{ supported: boolean; note: string }> {
  await ensureLoaded();
  return { supported, note };
}

export interface ActiveApp {
  name: string;
  /** Absolute path to the app's executable (used to extract its icon). */
  path: string | null;
}

/** Returns the focused application's name + executable path, or null. */
export async function getActiveApp(): Promise<ActiveApp | null> {
  await ensureLoaded();
  if (!supported || !activeWinFn) return null;
  try {
    const result = (await activeWinFn()) as
      | { owner?: { name?: string; path?: string } }
      | undefined;
    const name = result?.owner?.name;
    if (!name) return null;
    return { name, path: result?.owner?.path ?? null };
  } catch {
    return null;
  }
}

/** Returns the focused application's name, or null if unavailable. */
export async function getActiveAppName(): Promise<string | null> {
  return (await getActiveApp())?.name ?? null;
}
