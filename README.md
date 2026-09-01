# ☕ Deepbrew

A minimalist, distraction-free **focus-session timer that lives in your system
tray**. Start a Pomodoro-style session, work, and get gently nudged and
celebrated — all without opening a window. Cross-platform for **Windows and
Linux**, built with Electron + React + TypeScript.

Everything is **local-first**: no account, no login, no cloud. Your sessions and
analytics live in a local SQLite database on your machine.

> A from-scratch reimplementation of the concept behind kofeflow.com (a macOS
> menu-bar app), adapted for Windows/Linux.

---

## Features

- **Tray countdown** — a persistent tray icon showing a live progress ring with
  the remaining minutes/seconds, updated every second, color-coded per state
  (idle · focusing · paused · on-break). Full `MM:SS` in the tooltip.
- **Left-click popover** — a compact dropdown with start / pause / resume /
  extend (+5 min) / skip / reset / stop and a progress ring.
- **Right-click menu** — a native context menu with the same controls plus
  *Open dashboard* and *Quit*.
- **Configurable sessions** — work/break lengths (default 25 / 5) plus a
  **long break** every N sessions (default 15 min after 4), with optional
  auto-transition (work → break → work) or manual start of each phase.
- **Hand-drawn avatars** — original monochrome line-art illustrations for each
  state (ready / focusing / short break / long break) in the timer + popover.
- **Native notifications** — on session end, break end, and a **Smart Nudge**
  when you've been idle mid-session (based on OS idle time, not content).
- **Local analytics** — total focus hours (day/week/month), current & longest
  streaks, completed vs. abandoned sessions, and optional **active-app
  tracking** (which app had focus during a session). Fully opt-in/opt-out.
- **Dashboard** — a window with **Timer / Stats / Settings** tabs: an
  illustrated timer landing with quick stats (sparkline + top-activity), a Focus
  Analytics page (focus-time chart, app split, streak calendar, session
  history), and a full settings panel.
- **Shareable focus persona card** — a polished, monochrome card summarizing a
  day/week: focused hours, your **top apps** (from active-app tracking), and a
  **work-style** label derived from your session patterns (e.g. *Deep Diver*,
  *Sprinter*, *Steady Brewer*). Copy to clipboard or save as PNG —
  *"Share it — or keep it for yourself."*
- **Global shortcuts** — start/pause, reset, and open-dashboard, configurable.
- **Autostart on login**, light/dark/system theme, and full data control
  (export to JSON, delete everything).
- **Strict monochrome design** — a calm, uncluttered black-and-white system
  throughout (tray, popover, dashboard, card). Timer states are distinguished by
  shape, weight, and fill, never colour.

## Privacy

- No account, no sign-up, no content telemetry, no ads.
- The **only** possible outbound calls are (1) an optional update check and
  (2) optional, opt-**out**, anonymous "app opened" pings — both **off/endpoint-
  less by default**, so a stock build makes **zero** network requests.
- All data is stored locally in SQLite under your OS app-data directory:
  - Windows: `%APPDATA%\deepbrew\deepbrew.db`
  - Linux: `~/.config/deepbrew/deepbrew.db`

---

## Prerequisites

- **Node.js 18+** (developed on Node 22) and npm.
- A **native build toolchain** (needed to compile/rebuild `better-sqlite3` for
  Electron on first install):
  - **Windows**: Visual Studio Build Tools (the "Desktop development with C++"
    workload) and Python 3. Installing
    [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)
    is sufficient.
  - **Linux (Debian/Ubuntu)**: `sudo apt install build-essential python3`
  - **Linux (Fedora)**: `sudo dnf groupinstall "Development Tools" && sudo dnf install python3`

> The `postinstall` step runs `electron-builder install-app-deps`, which rebuilds
> native modules against Electron's ABI. If you don't have a toolchain, see
> [Native modules without a compiler](#native-modules-without-a-compiler).

## Setup

```bash
npm install
```

This installs dependencies and rebuilds native modules (`better-sqlite3`) for
Electron. `@napi-rs/canvas` (used to render the tray icon) and `active-win`
(active-app tracking) ship prebuilt binaries.

## Run in development

```bash
npm run dev
```

Launches the app with hot-reloading renderers. The app starts in the tray — look
for the coffee-cup icon. There is no main window by default; left-click the tray
icon for the popover, or right-click for the menu.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Run the app in development with HMR. |
| `npm run build` | Type-check and bundle main / preload / renderer to `out/`. |
| `npm test` | Run the unit tests (timer state machine + streak logic). |
| `npm run typecheck` | Type-check the whole project. |
| `npm run lint` | Lint the source. |
| `npm run pack:win` | Build + package Windows installer (NSIS `.exe`). |
| `npm run pack:linux` | Build + package Linux `.AppImage`, `.deb`, `.rpm`. |
| `npm run pack:all` | Package Windows + Linux. |
| `npm run pack:dir` | Build an unpacked app directory (fast, for testing). |

---

## Packaging

Packaging uses [electron-builder](https://www.electron.build/) (config in
[`electron-builder.yml`](electron-builder.yml)). Output goes to `release/`.

### Windows

```bash
npm run pack:win
```

Produces an NSIS installer (`.exe`) that installs per-user, creates Start-menu
and desktop shortcuts, and lets the user choose the install directory.
Autostart uses the Windows login-item API (the `Run` registry key). Notifications
use native Windows toasts.

> Build Windows targets on Windows.

### Linux

```bash
npm run pack:linux
```

Produces `.AppImage`, `.deb`, and `.rpm`. Autostart is handled via an XDG
`~/.config/autostart/deepbrew.desktop` file.

**Tray support / libappindicator.** Electron's tray on Linux relies on an app
indicator library, which some desktops don't ship by default. If the tray icon
doesn't appear:

- **Debian/Ubuntu (GNOME):**
  ```bash
  sudo apt install libayatana-appindicator3-1 gnome-shell-extension-appindicator
  ```
  (log out/in to enable the extension). The `.deb` declares this dependency.
- **Fedora:**
  ```bash
  sudo dnf install libappindicator-gtk3
  ```
  The `.rpm` declares this dependency.
- **KDE Plasma / XFCE:** tray works out of the box.

**Active-app tracking on Wayland.** Active-window inspection is restricted by
Wayland compositors. On Wayland the feature is automatically disabled and
Settings shows an explanation; it works on X11 sessions. Everything else works
on both.

> Build Linux targets on Linux (or in a Linux CI container). Cross-building from
> Windows is not supported for the Linux native modules.

### Native modules without a compiler

If you can't install a build toolchain, you can fetch a prebuilt
`better-sqlite3` binary matching your Electron version instead of compiling:

```bash
npm install --ignore-scripts
node node_modules/electron/install.js
cd node_modules/better-sqlite3 && npx prebuild-install --runtime=electron --target=$(node -p "require('electron/package.json').version") --arch=x64
```

---

## Architecture

```
src/
├── shared/            Pure, framework-free code shared by all layers
│   ├── timer/         The timer/session STATE MACHINE (pure, fully tested)
│   ├── streaks.ts     Pure streak math (tested)
│   ├── types.ts       App-wide types (Settings, Stats, …)
│   └── ipc-contract.ts  Typed IPC channels + window.kofe API surface
├── main/              Electron main process
│   ├── index.ts       App lifecycle & wiring (tray-only, single-instance)
│   ├── timer-controller.ts  Owns state, one 1s interval, records sessions
│   ├── tray.ts / tray-icon.ts  Tray + canvas-rendered icon
│   ├── windows.ts     Popover + dashboard BrowserWindows
│   ├── notifications.ts / idle nudges
│   ├── active-window.ts     active-win wrapper (degrades on Wayland)
│   ├── autostart.ts / shortcuts.ts / update-checker.ts / product-analytics.ts
│   └── db/            SQLite: database, settings-store, analytics-store
├── preload/           Context-isolated bridge exposing window.kofe
└── renderer/          React UI (popover + dashboard), monochrome theme
```

**Design notes**

- The **timer logic is a pure state machine** (`src/shared/timer`). It never
  reads the clock or does I/O — `now` is injected into every action — so it's
  deterministic and unit-tested. The main process wires a single 1-second
  interval to it (no busy-loop when idle/paused) and resyncs on system
  sleep/wake via `powerMonitor`.
- The **tray icon is rendered in the main process** with `@napi-rs/canvas`
  (a progress ring + remaining time), so there's no hidden window round-trip.
- The renderer has **no Node access** (context isolation on); everything goes
  through the typed `window.kofe` bridge.

## Testing

```bash
npm test
```

Covers the core timer/session state machine (start/pause/resume/extend/reset/
stop/skip, auto-transition, long-break cadence, phase completion, abandonment,
sleep/wake resync), the streak calculation, and the work-style derivation.

## License

MIT
