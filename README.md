# port-hole

Control OpenCode running on your home PC from a phone PWA, via a secure Tailscale tunnel. Send prompts, monitor agent activity in real time, resolve pending approvals — from anywhere.

## What It Does

- **Remote Control**: Access OpenCode from your phone without exposing it to the public internet
- **Real-time Updates**: See agent responses stream in real-time via Server-Sent Events
- **Approvals on the Go**: Review and approve permission requests from your phone
- **Secure Tunnel**: Uses Tailscale for encrypted, private networking between devices
- **Zero Install**: PWA runs in browser — no app store download required

## Architecture

```
OpenCode HTTP API (localhost:4096)
         ↕  localhost only
Bridge Server (0.0.0.0:3000)
         ↕  Tailscale private network
Phone Browser PWA
```

- **OpenCode**: Runs as HTTP server on your PC, never exposed to network
- **Bridge Server**: Node.js process that manages OpenCode, stores events, serves PWA
- **Tailscale**: Secure VPN tunnel between your PC and phone
- **PWA**: Single-page web app that runs in browser, can be added to home screen

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

## Running the App

### One-Time Setup - Create Icons

```powershell
# From project root
magick -size 192x192 xc:#6366f1 pwa/icon-192.png
magick -size 512x512 xc:#6366f1 pwa/icon-512.png
```

(Install ImageMagick with `winget install ImageMagick.ImageMagick` if needed)

### Start OpenCode HTTP Server

In a terminal on your PC:

```powershell
opencode serve --hostname 127.0.0.1 --port 4096
```

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

## Usage

### Sending Prompts

1. Select a session from the dropdown (auto-selects most recent)
2. Type your prompt in the textarea
3. Press Send or use Enter (Shift+Enter for newline)
4. Watch the response stream in real-time

### Managing Approvals

- When OpenCode needs approval, a yellow panel appears
- Review the description and tap **Allow** or **Deny**
- Cards show elapsed time and disappear when resolved

### Monitoring Activity

- Status dot shows connection: green (connected), red (disconnected), yellow (reconnecting)
- Chat view shows all messages with timestamps
- Tool calls and results are collapsible for clean reading
- Code blocks have copy buttons

## Troubleshooting

### Bridge Server Won't Start

- Check Node.js is installed: `node --version`
- Verify dependencies: `npm install`
- Check port 3000 isn't in use

### Can't Connect from Phone

- Verify Tailscale is connected on both devices
- Check firewall rule allows port 3000
- Use the exact Tailscale IP shown by bridge server

### OpenCode Not Responding

- Verify OpenCode HTTP server is running on port 4096
- Check `opencode.log` file in project root for errors
- Bridge server will auto-restart OpenCode if it crashes

### Status Shows Disconnected

- Check Tailscale connection on phone
- Verify bridge server is running
- Try refreshing the PWA page

## Development

### Running Tests

```bash
# Unit and integration tests
npm test

# With coverage
npm run test:coverage

# E2E tests (requires Playwright browsers)
npm run test:e2e

# All tests
npm run test:all
```

### Project Structure

```
port-hole/
├── server/           # Node.js bridge server
│   ├── src/         # TypeScript source
│   └── __tests__/   # Jest tests
├── e2e/             # Playwright E2E tests
├── pwa/             # Single-page web app
└── PLAN.md          # Detailed technical specification
```

## Security Considerations

- OpenCode is bound to `127.0.0.1` — never exposed to internet
- Tailscale provides end-to-end encryption
- Bridge server serves PWA on same origin — no CORS issues
- Optional OpenCode password protection supported

## Limitations (v1)

- Event history resets when bridge server restarts
- No push notifications — must open PWA to check for approvals
- Single OpenCode instance per bridge server
- Action queue lost on full page reload while disconnected
- No session creation from mobile (start sessions from PC)
