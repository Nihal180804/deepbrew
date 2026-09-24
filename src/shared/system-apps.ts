/**
 * OS shell / system surfaces that transiently steal focus (lock screen, search,
 * Start menu, IME host…) but aren't apps the user "works in". Shared by the
 * active-app sampler (filter at capture, by executable) and the analytics store
 * (prune already-logged rows, by stored name).
 *
 * NOTE: `explorer.exe` (File Explorer) and Settings are intentionally absent —
 * those are real apps people use.
 */

/** Executable basenames (lowercase). Most reliable match. */
export const SYSTEM_EXES = new Set<string>([
  'lockapp.exe',
  'logonui.exe',
  'searchhost.exe',
  'searchapp.exe',
  'searchui.exe',
  'startmenuexperiencehost.exe',
  'shellexperiencehost.exe',
  'applicationframehost.exe',
  'textinputhost.exe',
  'peopleexperiencehost.exe',
  'dwm.exe',
  'sihost.exe',
  'ctfmon.exe',
  'fontdrvhost.exe'
]);

/**
 * Possible stored `app_name` values (lowercased) for those surfaces — active-win
 * reports either a friendly name or the bare exe name, so include both forms so
 * previously-logged rows can be pruned.
 */
export const SYSTEM_APP_NAMES: string[] = [
  ...SYSTEM_EXES, // bare exe names (e.g. "lockapp.exe")
  'windows default lock screen',
  'search',
  'searchui',
  'cortana',
  'start',
  'task switching',
  'windows shell experience host'
];
