// Dev-only: builds a runnable preview of the real renderer bundle with a mocked
// window.kofe (sample data), so the dashboard/popover can be eyeballed without
// launching Electron. Writes out/renderer/__preview-*.html + kofe-mock.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'out', 'renderer');

const now = Date.now();
const DAY = 86400000;
function localDay(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const daily = [];
for (let i = 29; i >= 0; i--) {
  const focus = i % 7 === 6 ? 0.3 * 3600000 : (0.6 + Math.random() * 2.2) * 3600000;
  daily.push({
    day: localDay(now - i * DAY),
    focusMs: Math.round(focus),
    completedSessions: Math.round(focus / 1500000),
    abandonedSessions: i % 5 === 0 ? 1 : 0
  });
}
const activeDays = [];
for (let i = 0; i < 7; i++) activeDays.push(localDay(now - i * DAY));
for (const i of [9, 10, 11, 12, 14, 15]) activeDays.push(localDay(now - i * DAY));

const topApps = [
  { appName: 'Google Chrome', focusMs: 3.8 * 3600000, sessions: 12 },
  { appName: 'Codex', focusMs: 2.3 * 3600000, sessions: 8 },
  { appName: 'Slack', focusMs: 1.4 * 3600000, sessions: 6 },
  { appName: 'zoom.us', focusMs: 0.55 * 3600000, sessions: 3 },
  { appName: 'Terminal', focusMs: 0.37 * 3600000, sessions: 4 }
];
const stats = {
  todayFocusMs: 2.2 * 3600000,
  weekFocusMs: 11 * 3600000,
  monthFocusMs: 38 * 3600000,
  currentStreakDays: 7,
  longestStreakDays: 12,
  completedSessions: 24,
  abandonedSessions: 3,
  daily,
  topApps,
  activeDays
};
const sessions = [];
for (let i = 0; i < 8; i++) {
  sessions.push({
    id: i,
    phase: i % 3 === 2 ? 'break' : 'work',
    startedAt: now - i * 2400000,
    endedAt: now - i * 2400000 + 1500000,
    plannedMs: 1500000,
    actualMs: i % 4 === 3 ? 820000 : 1500000,
    completed: i % 4 !== 3,
    appName: i % 3 === 2 ? null : topApps[i % 3].appName
  });
}
const persona = {
  rangeLabel: 'Today',
  focusHours: 2.2,
  sessionsCompleted: 5,
  currentStreakDays: 7,
  topApps: topApps.slice(0, 3),
  workStyle: 'Deep Diver',
  workStyleBlurb: 'Long, uninterrupted dives into the work that matters.',
  peakLabel: 'Peak focus around 10 AM',
  generatedAt: now
};
const settings = {
  workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4,
  autoTransition: true, autostart: false, theme: 'system', notificationsEnabled: true,
  notificationSound: 'chime', soundEnabled: true, trackingEnabled: true,
  activeAppTrackingEnabled: true, productAnalyticsEnabled: false, updateCheckEnabled: true,
  smartNudgeIdleMinutes: 3,
  shortcuts: { startPause: 'CommandOrControl+Shift+Space', reset: 'CommandOrControl+Shift+R', openDashboard: 'CommandOrControl+Shift+D' }
};

function mock(snapshot) {
  return `window.kofe = {
  getTimer: () => Promise.resolve(${JSON.stringify(snapshot)}),
  sendCommand: () => Promise.resolve(${JSON.stringify(snapshot)}),
  getSettings: () => Promise.resolve(${JSON.stringify(settings)}),
  updateSettings: (p) => Promise.resolve(Object.assign(${JSON.stringify(settings)}, p)),
  getStats: () => Promise.resolve(${JSON.stringify(stats)}),
  getSessions: () => Promise.resolve(${JSON.stringify(sessions)}),
  getPersona: () => Promise.resolve(${JSON.stringify(persona)}),
  exportData: () => Promise.resolve({ ok: true }),
  deleteAllData: () => Promise.resolve({ ok: true }),
  getPlatform: () => Promise.resolve({ platform: 'win32', activeWindowSupported: true, activeWindowNote: '', appVersion: '0.1.0' }),
  openDashboard: () => Promise.resolve(),
  minimizeWindow: () => Promise.resolve(),
  toggleMaximizeWindow: () => Promise.resolve(false),
  closeWindow: () => Promise.resolve(),
  isWindowMaximized: () => Promise.resolve(false),
  togglePin: () => Promise.resolve(true),
  isPinned: () => Promise.resolve(false),
  copyImageToClipboard: () => Promise.resolve({ ok: true }),
  savePng: () => Promise.resolve({ ok: true }),
  onTimerUpdate: () => () => {}, onSettingsChanged: () => () => {}, onStatsInvalidated: () => () => {}
};`;
}

function makePreview(pageHtml, snapshot, suffix) {
  writeFileSync(join(outDir, `kofe-mock-${suffix}.js`), mock(snapshot));
  let html = readFileSync(join(outDir, pageHtml), 'utf8');
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
  html = html.replace('<body', `<body`).replace(
    /<body([^>]*)>/,
    `<body$1><script src="./kofe-mock-${suffix}.js"></script>`
  );
  writeFileSync(join(outDir, `__preview-${suffix}.html`), html);
}

const runningFocus = { status: 'running', phase: 'work', remainingMs: 18 * 60000, totalMs: 25 * 60000, progress: 0.28, workCyclesCompleted: 2, isLongBreak: false, at: now };
const shortBreak = { status: 'running', phase: 'break', remainingMs: 4 * 60000 + 26000, totalMs: 5 * 60000, progress: 0.11, workCyclesCompleted: 1, isLongBreak: false, at: now };

makePreview('dashboard.html', runningFocus, 'dash');
makePreview('popover.html', shortBreak, 'pop');
makePreview('pin.html', runningFocus, 'pin');
console.log('Wrote out/renderer/__preview-dash.html and __preview-pop.html');
