# Chat-Toys

**Chat-Toys** is an Electron-based desktop application for streamers that reads live chat from Twitch and YouTube and triggers interactive overlay widgets ("toys") in OBS via a local web server. Chat commands and channel point redemptions activate toys that render as browser sources directly in your broadcast.

---

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Building for Distribution](#building-for-distribution)
- [OBS Integration](#obs-integration)
- [License & Copyright](#license--copyright)

---

## Architecture

Chat-Toys follows a two-process Electron architecture with a local Express/WebSocket server for OBS integration:

```
┌──────────────────────────────────────────────────────┐
│                ELECTRON MAIN PROCESS                 │
│                                                      │
│  TwitchManager    OBSViewServer (Express + WS)       │
│  ChatSourceManager (YouTube)    SystemTray           │
│  DatabaseManager (SQLite)       IPC Bridge           │
└────────────────────┬─────────────────────────────────┘
                     │ IPC (preload)
┌────────────────────▼─────────────────────────────────┐
│           ELECTRON RENDERER PROCESS (Vue 3)          │
│                                                      │
│  ChatToysApp     ChatProcessor    CommandProcessor   │
│  ToyManager      OBSConnectionManager                │
│  YouTubeConnectionManager   VTSConnectionManager     │
│  20+ Toy Implementations                             │
└────────────────────┬─────────────────────────────────┘
                     │ HTTP / WebSocket (socket-ref)
┌────────────────────▼─────────────────────────────────┐
│       LOCAL EXPRESS SERVER  (default port 3001)      │
│                                                      │
│  Serves live.html for OBS browser sources            │
│  Real-time widget state via WebSocket                │
│  Twitch OAuth callback routes                        │
└──────────────────────────────────────────────────────┘
```

**Chat message flow:**

```
Twitch / YouTube Chat
  → ChatProcessor (deduplication, avatar caching, emoji parsing)
  → CommandProcessor (command detection, cooldown enforcement, cost validation)
  → Toy handler (onCommand callback)
  → socket-ref state update
  → Live widgets re-render in OBS
```

**State management layers:**

| Mechanism | Scope |
|---|---|
| `socketRef` / `socketShallowRef` | Synced to OBS live page via WebSocket |
| `chromeRef` / `chromeShallowRef` | Persisted to local storage across reloads |
| Vue `ref()` | Component-level reactive state |

---

## Features

### Toys

Each toy is independently configurable, can be enabled/disabled, and exposes chat commands with optional channel-points costs, cooldowns, and per-user limits.

| Toy | Description |
|---|---|
| **Chat** | Add a chat overlay to your stream. |
| **Shout** | Let users show on-screen messages for points. |
| **Head Pat / Bonk / Slap** | Let viewers give and receive head pats, bonks, and slaps. |
| **Karaoke Queue** | Manage a karaoke song queue with YouTube video requests. |
| **Prize Wheel** | Let viewers spin a wheel to win prizes. |
| **Fishing Mini-game** | Let viewers play a fishing mini-game on your stream. |
| **Horse Racing** | A competitive horse racing game for chatters. |
| **Gamba** | Let viewers gamble their points. |
| **Swarm** | Users can swarm messages on screen. |
| **Emoji Fountain** | Sprinkle chat emojis with physics-like animations. Responds to `!rain` and `!fountain` commands, or passively animates emojis found in normal chat messages. |
| **Tosser** | Let viewers toss configurable objects onto your stream using Three.js 3D physics. |
| **VTS Tosser** | Like Tosser, with VTube Studio integration so objects interact with your avatar. |
| **Stream Buddies** | Let viewers spawn animated companion characters on your stream. |
| **Channel Points** | Let users occasionally earn points for watching your stream. |
| **Media** | Display images, GIFs, or play sounds on your stream via chat commands. |
| **Output Log** | Show command output on screen and give real-time feedback to users on command status. |
| **Frequency Finder** | Detect and surface frequently repeated chat messages. |
| **Points 4 SuperChats** | Convert YouTube Super Chats into channel points. |
| **Widget Group** | Combine multiple widgets into one consolidated OBS layout. |

### Core Systems

- **Twitch Integration** — OAuth 2.0 authentication via tmi.js; full chat reading and channel point event handling.
- **YouTube Integration** — Live chat capture via an injected WebSocket script in the YouTube chat window.
- **OBS Integration** — OBS WebSocket API client for scene/source control.
- **VTube Studio Integration** — Plugin API connection for avatar interactions (used by VTS Tosser).
- **BetterTTV (BTTV)** — Emote resolution for Twitch chat.
- **Database** — SQLite-backed user profiles, channel points balances, command usage statistics, and ban records.
- **Chat Tester** — Standalone window to simulate chat commands without a live stream.
- **System Tray** — Minimal tray icon with quick controls for running in the background.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Desktop framework | Electron 32 |
| UI framework | Vue 3 + TypeScript |
| Build / dev server | Vite 4 |
| Styling | SCSS / Sass |
| 3D graphics | Three.js |
| HTTP server | Express 4 |
| WebSocket / state sync | socket-ref |
| Database | better-sqlite3 (SQLite) |
| Twitch chat client | tmi.js |
| OBS client | obs-websocket-js |
| Persistent config | electron-store |
| Packaging | electron-builder |

---

## Prerequisites

- **Node.js** 18 or later
- **Python 3.9** — required by `better-sqlite3` native module compilation on Windows (path configured in `.npmrc`)
- **Visual Studio Build Tools** (Windows) — C++ build tools for native module compilation

---

## Installation

```bash
git clone https://github.com/Orokro/Chat-Toys.git
cd Chat-Toys
npm install
```

The `postinstall` script automatically runs `electron-rebuild` to compile `better-sqlite3` and any other native modules for your platform.

---

## Development

```bash
npm run dev
```

This command:
1. Starts the Vite dev server on port **8080**
2. Watches `src/main/` for TypeScript changes and recompiles
3. Launches Electron pointed at the Vite dev server
4. Hot-reloads renderer changes without restarting Electron

---

## Building for Distribution

```bash
# Windows — NSIS installer
npm run build:win

# Windows — MSI installer
npm run build:msi

# macOS — DMG
npm run build:mac

# Linux — Snap package
npm run build:linux
```

The build script:
1. Compiles the renderer via Vite → `build/renderer/`
2. Compiles the main process via TypeScript → `build/main/`
3. Runs `electron-builder` to produce a platform installer in `dist/`

---

## OBS Integration

Chat-Toys runs a local HTTP/WebSocket server (default port **3001**). Add a **Browser Source** in OBS pointing to:

```
http://localhost:3001/live.html
```

**Options:**

| URL | Effect |
|---|---|
| `http://localhost:3001/live.html` | Full layout with all active widgets |
| `http://localhost:3001/live.html?toy=<slug>` | Single toy widget only |
| `http://localhost:3001/live.html?bg=<hex>` | Custom background color (e.g. `?bg=00ff00` for chroma key) |

The server port is configurable from the Settings page inside the application.

---

## License & Copyright

© 2025 Greg Miller ([gmiller.net](https://gmiller.net)). All rights reserved.

This repository and its contents are licensed under the Mozilla Public License (MPL 2.0) unless otherwise stated.
See the [LICENSE](./LICENSE) file for more details.

Unauthorized reproduction, modification, or distribution of this material without prior written permission is prohibited.
