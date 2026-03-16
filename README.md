# port-hole

Control OpenCode running on your home PC from a modern React PWA, via a secure Tailscale tunnel. Send prompts, monitor agent activity in real time, resolve pending approvals — from anywhere.

## Prerequisites

### What You Need

- OpenCode installed and configured with models
- A Windows PC that will run continuously during sessions
- Phone with browser (Safari on iOS, Chrome on Android)

### One-Time Setup

#### 1. Disable PC Sleep

Critical — if the PC sleeps, everything stops.

1. Open **Settings → System → Power & Sleep**
2. Set **Sleep** to **Never** for both battery and plugged in
3. Screen can turn off — that's fine, sleep is not

#### 2. Install Tailscale on PC

1. Download: https://tailscale.com/download/windows
2. Install and create free account at https://login.tailscale.com/start
3. Note your Tailscale IP (e.g., `100.x.x.x`) — you'll use this from your phone

#### 3. Configure Windows Firewall

Allow port 3000 for Tailscale traffic (run in admin PowerShell):

```powershell
New-NetFirewallRule -DisplayName "port-hole Bridge" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

#### 4. Install Tailscale on Phone

1. **iOS**: Download from App Store: https://apps.apple.com/app/tailscale/id1470499037
2. **Android**: Download from Play Store: https://play.google.com/store/apps/details?id=com.tailscale.ipn
3. Sign in with same account as PC
4. Tap toggle to connect
5. Verify your PC appears as connected

#### 5. Install Node.js on PC

```powershell
winget install OpenJS.NodeJS.LTS
```

## Installation

1. Clone this repository
2. Navigate to server directory: `cd port-hole/server`
3. Install dependencies: `npm install`
4. Navigate to React PWA directory: `cd port-hole/pwa-react`
5. Install dependencies: `npm install`
6. Build the React PWA: `npm run build`

## Running the App

### Start OpenCode HTTP Server

In a terminal on your PC:

```powershell
opencode serve --hostname 127.0.0.1 --port 4096
```

**Important**: This starts OpenCode in headless mode (HTTP API only). The PWA will connect to this background service.

**Alternative**: To use the OpenCode CLI interface simultaneously:

```powershell
opencode attach http://127.0.0.1:4096
```

This links the CLI to the running HTTP server, allowing you to:

- Use the CLI interface on your PC
- Control the same sessions from the PWA
- Switch models/sessions in either interface

**Note**: Changes made in CLI and PWA operate independently - they both connect to the same OpenCode backend but maintain separate UI state.

### Start Bridge Server

In another terminal on your PC:

```powershell
cd port-hole/server
npx tsx src/index.ts
```

The bridge server will display:

```
Bridge server running
Local:     http://localhost:3000
Tailscale: http://100.x.x.x:3000
```

### Access from Phone

1. Open browser on your phone
2. Navigate to the Tailscale URL shown above
3. Tap Share → Add to Home Screen for best experience

## Limitations (v1)

- Event history resets when bridge server restarts
- No push notifications — must open PWA to check for approvals
- Single OpenCode instance per bridge server
- Action queue lost on full page reload while disconnected
- No session creation from mobile (start sessions from PC)
