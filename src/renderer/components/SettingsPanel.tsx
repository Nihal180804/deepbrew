import { useEffect, useState, type ReactNode } from 'react';
import type { PlatformInfo, Settings } from '@shared/types.js';
import { Toggle } from './Toggle.js';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  onToast: (msg: string) => void;
}

const SOUNDS = ['none', 'chime', 'bell', 'ding'];

export function SettingsPanel({ settings, update, onToast }: Props) {
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    void window.kofe.getPlatform().then(setPlatform);
  }, []);

  const setShortcut = (key: keyof Settings['shortcuts'], value: string) =>
    update({ shortcuts: { ...settings.shortcuts, [key]: value } });

  const exportData = async () => {
    const res = await window.kofe.exportData();
    if (res.ok) onToast('Data exported');
  };

  const deleteData = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await window.kofe.deleteAllData();
    setConfirmDelete(false);
    onToast('All data deleted');
  };

  return (
    <div>
      <h1>Settings</h1>
      <p className="sub">Everything runs locally. No account, no cloud.</p>

      <div className="panel">
        <h2>Sessions</h2>
        <Row name="Focus length" desc="Length of a focus session, in minutes.">
          <NumberInput
            value={settings.workMinutes}
            min={1}
            max={180}
            onChange={(v) => update({ workMinutes: v })}
          />
        </Row>
        <Row name="Break length" desc="Length of a short break, in minutes.">
          <NumberInput
            value={settings.breakMinutes}
            min={1}
            max={60}
            onChange={(v) => update({ breakMinutes: v })}
          />
        </Row>
        <Row name="Long break length" desc="Length of a long break, in minutes.">
          <NumberInput
            value={settings.longBreakMinutes}
            min={1}
            max={90}
            onChange={(v) => update({ longBreakMinutes: v })}
          />
        </Row>
        <Row
          name="Sessions before long break"
          desc="Take a long break after this many focus sessions (0 to disable long breaks)."
        >
          <NumberInput
            value={settings.sessionsBeforeLongBreak}
            min={0}
            max={12}
            onChange={(v) => update({ sessionsBeforeLongBreak: v })}
          />
        </Row>
        <Row
          name="Auto-transition"
          desc="Automatically flow work → break → work. Turn off to start each phase manually."
        >
          <Toggle on={settings.autoTransition} onChange={(v) => update({ autoTransition: v })} />
        </Row>
      </div>

      <div className="panel">
        <h2>Notifications & nudges</h2>
        <Row name="Desktop notifications" desc="Notify on session end, break end, and Smart Nudges.">
          <Toggle
            on={settings.notificationsEnabled}
            onChange={(v) => update({ notificationsEnabled: v })}
          />
        </Row>
        <Row name="Sound" desc="Play a sound with notifications.">
          <Toggle on={settings.soundEnabled} onChange={(v) => update({ soundEnabled: v })} />
        </Row>
        <Row name="Notification sound" desc="Which sound to play.">
          <select
            className="control"
            value={settings.notificationSound}
            onChange={(e) => update({ notificationSound: e.target.value })}
          >
            {SOUNDS.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </Row>
        <Row
          name="Smart Nudge idle threshold"
          desc="Nudge you to wrap up or take a break after this many minutes of inactivity mid-session (0 to disable)."
        >
          <NumberInput
            value={settings.smartNudgeIdleMinutes}
            min={0}
            max={60}
            onChange={(v) => update({ smartNudgeIdleMinutes: v })}
          />
        </Row>
      </div>

      <div className="panel">
        <h2>Appearance & startup</h2>
        <Row name="Theme" desc="Light, dark, or follow the system.">
          <select
            className="control"
            value={settings.theme}
            onChange={(e) => update({ theme: e.target.value as Settings['theme'] })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Row>
        <Row name="Start on login" desc="Launch Deepbrew automatically when you sign in.">
          <Toggle on={settings.autostart} onChange={(v) => update({ autostart: v })} />
        </Row>
      </div>

      <div className="panel">
        <h2>Keyboard shortcuts</h2>
        <Row name="Start / pause" desc="Global shortcut to toggle the timer.">
          <TextInput value={settings.shortcuts.startPause} onCommit={(v) => setShortcut('startPause', v)} />
        </Row>
        <Row name="Reset" desc="Global shortcut to reset the current phase.">
          <TextInput value={settings.shortcuts.reset} onCommit={(v) => setShortcut('reset', v)} />
        </Row>
        <Row name="Open dashboard" desc="Global shortcut to open this window.">
          <TextInput
            value={settings.shortcuts.openDashboard}
            onCommit={(v) => setShortcut('openDashboard', v)}
          />
        </Row>
        <p className="hint">
          Use Electron accelerator syntax, e.g. <code>CommandOrControl+Shift+Space</code>. If a
          shortcut is already taken by the OS it will be skipped.
        </p>
      </div>

      <div className="panel">
        <h2>Privacy & tracking</h2>
        <Row
          name="Local analytics"
          desc="Record your sessions to compute focus stats and streaks. Stored only in a local SQLite database on this device."
        >
          <Toggle on={settings.trackingEnabled} onChange={(v) => update({ trackingEnabled: v })} />
        </Row>
        <Row
          name="Active-app tracking"
          desc={
            platform && !platform.activeWindowSupported
              ? `Unavailable on this system. ${platform.activeWindowNote}`
              : 'Log which application had focus during each session (local only).'
          }
        >
          <Toggle
            on={settings.activeAppTrackingEnabled && (platform?.activeWindowSupported ?? true)}
            onChange={(v) => update({ activeAppTrackingEnabled: v })}
          />
        </Row>
        <Row
          name="Anonymous product analytics"
          desc="Off by default. If enabled, sends only an anonymous 'app opened' ping — no content, no session data. Opt-out anytime."
        >
          <Toggle
            on={settings.productAnalyticsEnabled}
            onChange={(v) => update({ productAnalyticsEnabled: v })}
          />
        </Row>
        <Row name="Check for updates" desc="Check for a newer version on launch. Never installs automatically.">
          <Toggle on={settings.updateCheckEnabled} onChange={(v) => update({ updateCheckEnabled: v })} />
        </Row>
      </div>

      <div className="panel">
        <h2>Your data</h2>
        <p className="hint" style={{ marginBottom: 14 }}>
          Export everything as JSON, or permanently delete all locally stored sessions. Deletion
          cannot be undone.
        </p>
        <div className="row-actions">
          <button className="btn ghost" onClick={() => void exportData()}>
            Export my data (JSON)
          </button>
          <button className="btn danger" onClick={() => void deleteData()}>
            {confirmDelete ? 'Click again to confirm' : 'Delete all data'}
          </button>
          {confirmDelete && (
            <button className="btn ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {platform && <p className="hint">Deepbrew v{platform.appVersion} · {platform.platform}</p>}
    </div>
  );
}

function Row({ name, desc, children }: { name: string; desc: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="info">
        <div className="name">{name}</div>
        <div className="desc">{desc}</div>
      </div>
      <div className="control">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const v = parseInt(e.target.value, 10);
        if (!Number.isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
      }}
    />
  );
}

function TextInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
