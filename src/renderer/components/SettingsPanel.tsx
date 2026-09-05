import { useEffect, useState, type ReactNode } from 'react';
import type { PlatformInfo, Settings } from '@shared/types.js';
import { Toggle } from './Toggle.js';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  onToast: (msg: string) => void;
}

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

  const appTrackingAvailable = platform?.activeWindowSupported ?? true;

  return (
    <div className="settings">
      <h1>Settings</h1>
      <p className="sub">Everything runs locally. No account, no cloud.</p>

      <Group title="Timer">
        <SRow name="Focus length">
          <Stepper value={settings.workMinutes} min={1} max={180} unit="min" onChange={(v) => update({ workMinutes: v })} />
        </SRow>
        <SRow name="Break length">
          <Stepper value={settings.breakMinutes} min={1} max={60} unit="min" onChange={(v) => update({ breakMinutes: v })} />
        </SRow>
        <SRow name="Long break length">
          <Stepper value={settings.longBreakMinutes} min={1} max={90} unit="min" onChange={(v) => update({ longBreakMinutes: v })} />
        </SRow>
        <SRow name="Sessions before long break" desc="Set to 0 to disable long breaks.">
          <Stepper value={settings.sessionsBeforeLongBreak} min={0} max={12} onChange={(v) => update({ sessionsBeforeLongBreak: v })} />
        </SRow>
        <SRow name="Auto-transition" desc="Flow work → break → work automatically.">
          <Toggle on={settings.autoTransition} onChange={(v) => update({ autoTransition: v })} />
        </SRow>
      </Group>

      <Group title="Notifications">
        <SRow name="Desktop notifications">
          <Toggle on={settings.notificationsEnabled} onChange={(v) => update({ notificationsEnabled: v })} />
        </SRow>
        <SRow name="Sound" desc="Play the system sound with notifications.">
          <Toggle on={settings.soundEnabled} onChange={(v) => update({ soundEnabled: v })} />
        </SRow>
        <SRow name="Smart nudge" desc="Nudge you after this many idle minutes mid-session. 0 disables.">
          <Stepper value={settings.smartNudgeIdleMinutes} min={0} max={60} unit="min" onChange={(v) => update({ smartNudgeIdleMinutes: v })} />
        </SRow>
      </Group>

      <Group title="Appearance & startup">
        <SRow name="Theme">
          <Select value={settings.theme} onChange={(v) => update({ theme: v as Settings['theme'] })}
            options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} />
        </SRow>
        <SRow name="Start on login" desc="Launch Deepbrew automatically when you sign in to Windows.">
          <Toggle on={settings.autostart} onChange={(v) => update({ autostart: v })} />
        </SRow>
        <SRow name="Start focus on launch" desc="Begin a focus session automatically when the app opens.">
          <Toggle on={settings.autoStartFocusOnLaunch} onChange={(v) => update({ autoStartFocusOnLaunch: v })} />
        </SRow>
        <SRow name="Show pin on launch" desc="Open the floating mini-timer when the app opens.">
          <Toggle on={settings.openPinOnLaunch} onChange={(v) => update({ openPinOnLaunch: v })} />
        </SRow>
        <SRow name="Reduce memory usage" desc="Turns off GPU acceleration to lower RAM (~50 MB). Transparent edges may look less smooth. Restart to apply.">
          <Toggle on={settings.reduceMemory} onChange={(v) => update({ reduceMemory: v })} />
        </SRow>
        <SRow name="Pinned timer size">
          <Select value={settings.pinSize} onChange={(v) => update({ pinSize: v as Settings['pinSize'] })}
            options={[['compact', 'Compact'], ['medium', 'Medium'], ['large', 'Large']]} />
        </SRow>
      </Group>

      <Group
        title="Shortcuts"
        footer={<>Global hotkeys in Electron accelerator syntax (e.g. <code>CommandOrControl+Shift+Space</code>). Combos reserved by the OS are skipped.</>}
      >
        <SRow name="Start / pause">
          <TextInput value={settings.shortcuts.startPause} onCommit={(v) => setShortcut('startPause', v)} />
        </SRow>
        <SRow name="Reset">
          <TextInput value={settings.shortcuts.reset} onCommit={(v) => setShortcut('reset', v)} />
        </SRow>
        <SRow name="Open dashboard">
          <TextInput value={settings.shortcuts.openDashboard} onCommit={(v) => setShortcut('openDashboard', v)} />
        </SRow>
      </Group>

      <Group title="Privacy">
        <SRow name="Local analytics" desc="Store sessions on this device to compute stats & streaks.">
          <Toggle on={settings.trackingEnabled} onChange={(v) => update({ trackingEnabled: v })} />
        </SRow>
        <SRow
          name="Active-app tracking"
          desc={appTrackingAvailable
            ? 'Log which app had focus during each session (local only).'
            : `Unavailable on this system. ${platform?.activeWindowNote ?? ''}`}
        >
          <Toggle
            on={settings.activeAppTrackingEnabled && appTrackingAvailable}
            onChange={(v) => update({ activeAppTrackingEnabled: v })}
          />
        </SRow>
        <SRow name="Anonymous analytics" desc="Off by default. Sends only an anonymous “app opened” ping — no session data.">
          <Toggle on={settings.productAnalyticsEnabled} onChange={(v) => update({ productAnalyticsEnabled: v })} />
        </SRow>
        <SRow name="Check for updates" desc="On launch only. Never installs automatically.">
          <Toggle on={settings.updateCheckEnabled} onChange={(v) => update({ updateCheckEnabled: v })} />
        </SRow>
      </Group>

      <Group title="Data" footer="Deletion is permanent and cannot be undone.">
        <div className="srow srow-buttons">
          <button className="btn ghost" onClick={() => void exportData()}>Export data (JSON)</button>
          <button className="btn danger" onClick={() => void deleteData()}>
            {confirmDelete ? 'Click again to confirm' : 'Delete all data'}
          </button>
          {confirmDelete && (
            <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
          )}
        </div>
      </Group>

      {platform && <p className="settings-footer">Deepbrew v{platform.appVersion} · {platform.platform}</p>}
    </div>
  );
}

function Group({ title, footer, children }: { title: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="settings-group">
      <div className="group-title">{title}</div>
      <div className="group-card">{children}</div>
      {footer && <p className="group-footer">{footer}</p>}
    </div>
  );
}

function SRow({ name, desc, children }: { name: string; desc?: string; children: ReactNode }) {
  return (
    <div className="srow">
      <div className="srow-main">
        <div className="srow-name">{name}</div>
        {desc && <div className="srow-desc">{desc}</div>}
      </div>
      <div className="srow-control">{children}</div>
    </div>
  );
}

function Stepper({
  value, min, max, unit, onChange
}: { value: number; min: number; max: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <>
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
      {unit && <span className="unit-label">{unit}</span>}
    </>
  );
}

function Select({ value, options, onChange }: { value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
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
