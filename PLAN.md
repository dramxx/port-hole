# port-hole — PLAN.md

> **Goal:** Control OpenCode running on your home PC from an iPhone PWA, via a secure Tailscale tunnel.
> Send prompts, monitor agent activity in real time, resolve pending approvals — from anywhere.

---

## 1. Prerequisites & Setup

### What You Already Might Have

- OpenCode installed and configured with models
- A Windows PC that will run continuously during sessions

---

### 1.1 Disable PC Sleep

**Critical.** If the PC sleeps, everything dies — OpenCode, the bridge server, Tailscale. Do this before anything else.

1. Open **Settings → System → Power & Sleep**
2. Set **Sleep** to **Never** for both battery and plugged in
3. Set **Screen** to whatever you want — screen turning off is fine, sleep is not

Locking the screen (Win+L) is fine and does not affect running processes.

---

### 1.2 Tailscale — PC

1. Download Tailscale for Windows: https://tailscale.com/download/windows
2. Run the installer
3. When prompted, create a free account at https://login.tailscale.com/start
   - Free tier supports up to 3 devices
4. After login, Tailscale starts automatically and assigns your PC a stable private IP (e.g. `100.x.x.x`)
5. Note that IP — you will use it to access the PWA from your phone

**Verify:**

```powershell
tailscale status
```

Should show your PC listed as connected with its Tailscale IP.

---

### 1.3 Windows Firewall — Allow Port 3000

By default Windows Firewall blocks incoming connections on port 3000. Tailscale traffic counts as incoming and will be blocked without this rule.

Run in an **admin** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "port-hole Bridge" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

Verify the rule was created:

```powershell
Get-NetFirewallRule -DisplayName "port-hole Bridge"
```

---

### 1.4 Tailscale — Phone (iOS/Android)

1. Download Tailscale
2. Open the app, sign in with the **same account** you created on PC
3. Tap the toggle to connect
4. You should see your PC listed as a connected device with its Tailscale IP

**Verify:** In the Tailscale app on phone, your PC shows as `Connected`.

---

### 1.5 Node.js — PC

Required to run the bridge server.

```powershell
winget install OpenJS.NodeJS.LTS
```

Restart terminal after install. Verify:

```powershell
node --version
npm --version
```

---

## 2. OpenCode HTTP Server

OpenCode runs as a TUI by default. The HTTP server is a separate headless mode.

### Enable

Run in a terminal in your project directory:

```powershell
opencode serve --hostname 127.0.0.1 --port 4096
```

- `127.0.0.1` binds to localhost only. The bridge server is the only thing that talks to OpenCode. OpenCode is never exposed to the network.
- Do **not** use `0.0.0.0` for OpenCode. Only the bridge server uses `0.0.0.0`.

### Optional — Password Protection

```powershell
$env:OPENCODE_SERVER_PASSWORD="yourpassword"
opencode serve --hostname 127.0.0.1 --port 4096
```

### Test

With OpenCode serve running, visit in a browser on your PC:

```
http://localhost:4096/global/health
```

Expected response:

```json
{ "healthy": true, "version": "..." }
```

View the full interactive API spec at:

```
http://localhost:4096/doc


```

### Key API Reference

| Method | Endpoint                                 | Purpose                                |
| ------ | ---------------------------------------- | -------------------------------------- |
| `GET`  | `/global/health`                         | Health check, version                  |
| `GET`  | `/event`                                 | SSE stream — all real-time events      |
| `GET`  | `/session`                               | List all sessions                      |
| `GET`  | `/session/:id`                           | Get session details                    |
| `GET`  | `/session/:id/message`                   | Full message history for a session     |
| `POST` | `/session/:id/message`                   | Send prompt, waits for full response   |
| `POST` | `/session/:id/prompt_async`              | Send prompt, returns 204 immediately   |
| `POST` | `/session/:id/permissions/:permissionID` | Approve or reject a permission request |
| `POST` | `/session/:id/abort`                     | Abort a running session                |

### Sending a Prompt — Exact Payload

```json
POST /session/:id/prompt_async
{
  "parts": [
    { "type": "text", "text": "your prompt text here" }
  ]
}
```

`prompt_async` returns `204 No Content` immediately and does not wait for the model response. Always use this from the PWA so the phone does not hang on a long-running request. The response arrives via the SSE event stream.

### Permission Approval — Exact Payload

```json
POST /session/:id/permissions/:permissionID
{
  "response": "allow",
  "remember": false
}
```

`response` is `"allow"` or `"deny"`. `remember: true` tells OpenCode to stop asking for this permission type in future — use with caution.

### SSE Event Stream

`GET /event` returns a persistent Server-Sent Events stream.

Each raw SSE message from OpenCode has this exact shape:

```
data: {"type": "message.part.updated", "properties": { ... }}
```

The event type is always at the top-level `type` field. All event-specific data is nested inside the top-level `properties` field. Never assume fields are at the top level — always read from `event.properties.*`.

Relevant event types and their `properties` fields:

| `type`                 | When it fires                           | Fields inside `properties`                 |
| ---------------------- | --------------------------------------- | ------------------------------------------ |
| `session.updated`      | Session state changes                   | `sessionId`, `status`                      |
| `message.part.updated` | Model is streaming a response           | `sessionId`, `messageId`, `part`           |
| `permission.asked`     | OpenCode wants approval to do something | `sessionId`, `permissionId`, `description` |
| `session.error`        | Something went wrong                    | `sessionId`, `error`                       |

Parsing example:

```typescript
const event = JSON.parse(rawData);
// event.type === "permission.asked"
// event.properties.sessionId
// event.properties.permissionId
// event.properties.description
```

---

## 3. App Development Plan

### Overview

The app has two parts:

- **Bridge Server** — Node.js/TypeScript process on your PC. Manages OpenCode, stores event history, relays events to connected phones, proxies phone inputs back to OpenCode.
- **PWA Frontend** — Static HTML/JS served by the bridge server. Runs in iPhone Safari. No install required on the phone beyond Tailscale.

```
OpenCode HTTP API (localhost:4096)
         ↕  localhost only
Bridge Server (0.0.0.0:3000)
         ↕  Tailscale private network
iPhone Safari PWA
```

**Important:** The PWA is served by the bridge server. All requests from the phone go to the same origin — same IP, same port 3000. There is no cross-origin situation. No CORS configuration is needed or should be added.

---

### 3.1 Project Structure

```
port-hole/
├── server/
│   ├── src/
│   │   ├── __tests__/          # Jest test files
│   │   │   ├── unit/           # Unit tests for individual modules
│   │   │   ├── integration/    # Integration tests for APIs
│   │   │   └── setup.ts        # Jest global setup
│   │   ├── index.ts          # Entry point — wires everything together, no other module does wiring
│   │   ├── process.ts        # OpenCode process manager
│   │   ├── opencode.ts       # OpenCode API client + SSE subscription
│   │   ├── store.ts          # Event log + approval queue (in-memory)
│   │   ├── bridge.ts         # SSE relay to phone clients
│   │   └── routes.ts         # All HTTP routes
│   ├── tsconfig.json
│   ├── jest.config.js        # Jest configuration
│   └── package.json
├── e2e/                       # Playwright E2E tests
│   ├── pwa-basic.test.ts
│   ├── reconnect.test.ts
│   └── playwright.config.ts
├── pwa/
│   ├── index.html            # Entire PWA — single file
│   ├── sw.js                 # Service Worker — reconnect only (see spec)
│   ├── icon-192.png          # Manual step — create before running (see 3.4)
│   ├── icon-512.png          # Manual step — create before running (see 3.4)
│   └── manifest.json         # PWA manifest for iOS home screen
└── PLAN.md
```

---

### 3.2 Tech Stack

| Layer               | Technology                      | Reason                                                          |
| ------------------- | ------------------------------- | --------------------------------------------------------------- |
| Server runtime      | Node.js 20 LTS                  | Stable, well-supported                                          |
| Language            | TypeScript                      | Type safety across API boundaries                               |
| HTTP framework      | Fastify                         | Lightweight, fast, good TypeScript support                      |
| OpenCode SSE client | `eventsource` npm package       | Handles SSE reconnect in Node — not the browser EventSource     |
| Env config          | `dotenv` npm package            | Read `.env` file at startup                                     |
| Testing             | Jest + Playwright               | Jest for unit/integration tests, Playwright for E2E PWA testing |
| Frontend            | Vanilla JS + HTML, no framework | No build step, single file, works in any browser                |
| Service Worker      | Native browser API              | Background reconnect only (see spec)                            |

---

### 3.3 Runtime and TypeScript Configuration

**This project always runs via `tsx` directly — it is never compiled to a `dist/` folder.**

All `npx tsx src/index.ts` — no `tsc` build step for running. `tsc --noEmit` is used only for type checking.

**tsconfig.json must use:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

Use `module: CommonJS` and `moduleResolution: Node` — not NodeNext. This avoids requiring `.js` extensions on all local imports, which is incompatible with how `tsx` resolves files. Do not use `import.meta.url` or `__dirname` alternatives needed for ESM — CommonJS `__dirname` works directly.

**Static file path pattern** — use `__dirname` which is available in CommonJS:

```typescript
import path from "path";
const PWA_DIR = path.join(__dirname, "..", "..", "pwa");
```

This resolves correctly when running from `server/src/index.ts` via `tsx`.

**dotenv** — call `dotenv.config()` as the very first line of `index.ts` before any other imports that read env vars:

```typescript
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
```

Create a `.env` file in the project root (not `server/`) with:

```
OPENCODE_PORT=4096
BRIDGE_PORT=3000
OPENCODE_HOST=127.0.0.1
```

---

### 3.4 Module Specs

#### Dependency Wiring — `index.ts` is the only wiring point

**Critical:** No module imports another module from this project except `index.ts`. Specifically:

- `store.ts` does NOT import `opencode.ts` or `bridge.ts`
- `bridge.ts` does NOT import `opencode.ts` or `store.ts`
- `opencode.ts` does NOT import `store.ts` or `bridge.ts`
- `routes.ts` imports `opencode.ts`, `store.ts`, and `bridge.ts` only for calling their methods — no circular dependency
- `index.ts` is the only file that calls `subscribeToEvents` and wires the callback chain

The wiring in `index.ts`:

```typescript
opencode.subscribeToEvents((event) => {
  store.appendEvent(event);
  bridge.broadcast(event);
  if (event.type === "permission.asked") {
    store.addPendingApproval({
      permissionId: event.properties.permissionId,
      sessionId: event.properties.sessionId,
      description: event.properties.description,
    });
  }
});
```

---

#### Module: `process.ts` — OpenCode Process Manager

**Responsibility:** Ensure OpenCode HTTP server is running. Restart it if it crashes.

**Startup behaviour:**

1. Call `GET http://127.0.0.1:4096/global/health` with a 2 second timeout using `AbortController`
2. If `{ healthy: true }` received → already running, emit `ready`, done
3. If request fails or times out → spawn `opencode serve --hostname 127.0.0.1 --port 4096`
4. Spawn must use `child_process.spawn` with `{ shell: true }` — required on Windows to resolve PATH entries:
   ```typescript
   const child = spawn("opencode serve --hostname 127.0.0.1 --port 4096", [], {
     shell: true,
   });
   ```
5. Pipe child stdout and stderr to a file write stream targeting `opencode.log` in the project root — do not pipe to process.stdout
6. After spawning, poll `GET /global/health` every 1 second for up to 15 seconds
7. If healthy within 15 seconds → emit `ready`
8. If not healthy after 15 seconds → emit `error` with message `"OpenCode did not start within 15 seconds"`, do not proceed

**Crash recovery:**

- If child process emits `exit` event unexpectedly (exit code !== 0 or null) → log the exit code
- Wait 2 seconds → attempt restart from step 1
- Track consecutive restart attempts in a module-level counter
- After 5 consecutive failures → emit `fatal` with message `"OpenCode failed to restart 5 times"`, stop retrying
- Reset counter to 0 after the process has been running stably for 10 minutes (use a `setTimeout` that resets the counter)

**Exposed interface:**

```typescript
export function getStatus(): "starting" | "running" | "restarting" | "fatal";
export const processEvents: EventEmitter; // emits 'ready', 'error', 'fatal'
```

---

#### Module: `store.ts` — Event Log & Approval Queue

**Responsibility:** Persist everything OpenCode emits so a late-connecting phone gets the full picture.

**Event log:**

- Module-level array: `const eventLog: EventLogEntry[] = []`
- Entry shape:
  ```typescript
  interface EventLogEntry {
    id: string; // uuid v4 generated on receipt
    timestamp: number; // Date.now()
    raw: object; // Original parsed JSON from OpenCode SSE — the full { type, properties } object
  }
  ```
- `appendEvent(raw: object): EventLogEntry` — generate uuid, push to array, return entry
- `getEventLog(): EventLogEntry[]` — return full array
- Resets on bridge server restart — acceptable for v1

**Approval queue:**

- Module-level Map: `const approvalQueue = new Map<string, ApprovalEntry>()`
- Entry shape:
  ```typescript
  interface ApprovalEntry {
    permissionId: string;
    sessionId: string;
    description: string;
    timestamp: number;
    status: "pending" | "resolved";
    resolution?: "allow" | "deny";
    resolvedAt?: number;
  }
  ```
- `addPendingApproval(entry: Omit<ApprovalEntry, 'status' | 'timestamp'>): void`
  - If `permissionId` already exists in the map → do nothing (idempotent, handles duplicate events on reconnect)
  - Otherwise add with `status: 'pending'` and `timestamp: Date.now()`
- `resolveApproval(permissionId: string, resolution: 'allow' | 'deny'): void`
  - If `permissionId` not found → throw `Error('Unknown permissionId')`
  - Update entry: `status: 'resolved'`, `resolution`, `resolvedAt: Date.now()`
- `getPendingApprovals(): ApprovalEntry[]` — return only entries where `status === 'pending'`

---

#### Module: `opencode.ts` — OpenCode API Client

**Responsibility:** Typed wrapper around OpenCode HTTP API. All communication with OpenCode goes through this module.

**Base URL:** Read from env: `http://${process.env.OPENCODE_HOST}:${process.env.OPENCODE_PORT}`

**eventsource import** — use the npm package, not the browser built-in:

```typescript
import EventSource from "eventsource";
```

The `eventsource` npm package exports a default class with the same interface as browser `EventSource` but works in Node.js.

**Methods:**

```typescript
export async function health(): Promise<{ healthy: boolean; version: string }>;
// GET /global/health
// Use AbortController with 2000ms timeout
// Throw if response is not 2xx

export async function getSessions(): Promise<Session[]>;
// GET /session
// Returns array — may be empty

export async function getMessages(
  sessionId: string,
): Promise<MessageWithParts[]>;
// GET /session/:id/message

export async function sendPrompt(
  sessionId: string,
  text: string,
): Promise<void>;
// POST /session/:id/prompt_async
// Body: { "parts": [{ "type": "text", "text": text }] }
// Expect 204. Throw OpenCodeError on any other status.

export async function approvePermission(
  sessionId: string,
  permissionId: string,
  allow: boolean,
): Promise<void>;
// POST /session/:id/permissions/:permissionId
// Body: { "response": allow ? "allow" : "deny", "remember": false }

export async function abortSession(sessionId: string): Promise<void>;
// POST /session/:id/abort

export function subscribeToEvents(onEvent: (event: object) => void): () => void;
// Opens GET /event SSE stream using eventsource npm package
// On each message: parse event.data as JSON, call onEvent with parsed object
// On error or close: wait 1000ms, create new EventSource, reconnect — no maximum retries
// Returns an unsubscribe function that closes the EventSource and stops reconnecting
```

**Error type:**

```typescript
export class OpenCodeError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
```

Throw `OpenCodeError` on any non-2xx response from any method.

**Session shape** (used by PWA for sorting):

```typescript
interface Session {
  id: string;
  title?: string;
  updatedAt: number; // Unix ms timestamp — use this field to sort by most recent activity
}
```

---

#### Module: `bridge.ts` — Phone Client SSE Relay

**Responsibility:** Maintain connected phone clients. Send history on connect. Relay live events.

**Fastify SSE pattern** — Fastify closes the response after `reply.send()`. For SSE you must write directly to `reply.raw` (the underlying Node.js `http.ServerResponse`) and never call `reply.send()`:

```typescript
export function handleNewClient(
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const raw = reply.raw;
  raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  // Send events by writing to raw:
  raw.write(
    `event: history\ndata: ${JSON.stringify({ events: store.getEventLog() })}\n\n`,
  );
  // ... etc
  // Add to clients map, remove on close:
  const clientId = uuid();
  clients.set(clientId, raw);
  raw.on("close", () => clients.delete(clientId));
  // Do NOT call reply.send() or reply.end()
}
```

**On new phone client connecting — exact sequence:**

1. Write SSE headers to `reply.raw`
2. Write `history` event:
   ```
   event: history\ndata: {"events":[...all EventLogEntry objects...]}\n\n
   ```
3. Write `approvals` event:
   ```
   event: approvals\ndata: {"approvals":[...pending ApprovalEntry objects...]}\n\n
   ```
4. Write `connected` event:
   ```
   event: connected\ndata: {"clientId":"...","timestamp":1234567890}\n\n
   ```
5. Add `clientId → reply.raw` to clients Map
6. Register `reply.raw.on('close', ...)` to remove client from Map on disconnect

**`broadcast(event: object): void`:**

- Iterate all clients in Map
- For each client write: `event: opencode\ndata: ${JSON.stringify(event)}\n\n`
- If write throws → catch silently, delete that clientId from Map

**Keepalive:** `setInterval` every 30 seconds — write `: keepalive\n\n` to all clients. Same error handling as broadcast.

**Exposed interface:**

```typescript
export function handleNewClient(
  request: FastifyRequest,
  reply: FastifyReply,
): void;
export function broadcast(event: object): void;
export function getConnectedClientCount(): number;
```

`bridge.ts` imports `store.ts` only to call `store.getEventLog()` and `store.getPendingApprovals()` inside `handleNewClient`. This is the only cross-module import allowed besides `index.ts`.

---

#### Module: `routes.ts` — HTTP Routes

Import `opencode`, `store`, and `bridge` modules. Register all routes on the Fastify instance passed as parameter.

```typescript
export function registerRoutes(app: FastifyInstance): void { ... }
```

**Static file serving:**

```typescript
import path from "path";
const PWA_DIR = path.join(__dirname, "..", "..", "pwa");
// Serve index.html for GET /
app.get("/", (req, reply) => reply.sendFile("index.html", PWA_DIR));
// Serve sw.js and manifest.json similarly
```

**All routes:**

| Method | Path                                      | Handler                                                                                              |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET`  | `/`                                       | Serve `pwa/index.html`                                                                               |
| `GET`  | `/sw.js`                                  | Serve `pwa/sw.js`                                                                                    |
| `GET`  | `/manifest.json`                          | Serve `pwa/manifest.json`                                                                            |
| `GET`  | `/stream`                                 | Call `bridge.handleNewClient(request, reply)`                                                        |
| `GET`  | `/api/status`                             | Return `{ opencodeStatus: process.getStatus(), connectedClients: bridge.getConnectedClientCount() }` |
| `GET`  | `/api/sessions`                           | Call `opencode.getSessions()`, return result                                                         |
| `GET`  | `/api/sessions/:id/messages`              | Call `opencode.getMessages(params.id)`, return result                                                |
| `POST` | `/api/sessions/:id/prompt`                | Validate + call `opencode.sendPrompt()`                                                              |
| `POST` | `/api/sessions/:id/approve/:permissionId` | Validate + call `opencode.approvePermission()` + `store.resolveApproval()`                           |
| `POST` | `/api/sessions/:id/abort`                 | Call `opencode.abortSession(params.id)`                                                              |

**Input validation:**

- `POST .../prompt` — body must have `text` as non-empty string. If missing or empty: return `400 { "error": "text is required and must be a non-empty string" }`
- `POST .../approve/:permissionId` — body must have `allow` as boolean. If missing or not strictly boolean: return `400 { "error": "allow is required and must be a boolean" }`

**Error handling:** Every async route handler is wrapped in try/catch. On `OpenCodeError`: return its `status` code with `{ "error": error.message }`. On any other error: return `500 { "error": "Internal server error" }`. Never let unhandled exceptions propagate.

**No CORS.** Same origin. Do not add any CORS headers.

---

#### Module: `index.ts` — Entry Point

```typescript
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
// All other imports below dotenv.config()
```

**Startup sequence:**

1. Load env via dotenv (first two lines above)
2. Start process manager, wait for `ready` event
3. On `fatal` from process manager → `console.error(message)` → `process.exit(1)`
4. Once `ready` received → create Fastify instance
5. Register routes via `registerRoutes(app)`
6. Wire event subscription (see wiring block in dependency wiring section)
7. Start Fastify on `0.0.0.0` port from `process.env.BRIDGE_PORT`
8. On successful start → detect Tailscale IP and log both URLs

**Tailscale IP detection:**

```typescript
import os from "os";

function getTailscaleIP(): string | null {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface ?? []) {
      if (addr.family === "IPv4" && addr.address.startsWith("100.")) {
        // Tailscale IPs are in the 100.64.0.0/10 CGNAT range
        const parts = addr.address.split(".").map(Number);
        if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) {
          return addr.address;
        }
      }
    }
  }
  return null;
}
```

**Startup log format:**

```
Bridge server running
Local:     http://localhost:3000
Tailscale: http://100.x.x.x:3000   (or "Tailscale: not detected" if IP not found)
```

**Graceful shutdown on `SIGINT`:**

1. Close Fastify: `await app.close()`
2. Send SIGTERM to OpenCode child process if it was spawned by this process
3. `process.exit(0)`

---

### 3.5 PWA Frontend — Detailed Spec

Single file: `pwa/index.html`. No build step. No framework. No bundler.

#### On Load Sequence

Execute in this exact order — do not parallelise:

1. Register Service Worker from `/sw.js`
2. `GET /api/sessions` → populate session selector, auto-select session with highest `updatedAt` value
3. Open SSE connection to `/stream` using browser `EventSource`
4. On `history` event → parse `data.events`, render full event log in chat view
5. On `approvals` event → parse `data.approvals`, render in approval panel
6. On `connected` event → set status dot to green
7. On subsequent `opencode` events → parse and append to chat in real time

#### SSE Listening in PWA

```javascript
const es = new EventSource("/stream");
es.addEventListener("history", (e) => {
  const d = JSON.parse(e.data);
  renderHistory(d.events);
});
es.addEventListener("approvals", (e) => {
  const d = JSON.parse(e.data);
  renderApprovals(d.approvals);
});
es.addEventListener("connected", (e) => {
  setStatus("connected");
});
es.addEventListener("opencode", (e) => {
  const d = JSON.parse(e.data);
  appendEvent(d);
});
es.onerror = () => setStatus("disconnected");
```

The browser `EventSource` auto-reconnects natively — do not re-implement reconnect logic in the main thread. The Service Worker handles the status indicator updates only.

#### Session Management

- `<select id="session-select">` in header populated from `/api/sessions`
- Sort sessions by `updatedAt` descending — select index 0 (most recent) by default
- On selection change → call `GET /api/sessions/:id/messages`, re-render chat view with result
- All prompts and approval actions use the currently selected session id
- If `/api/sessions` returns empty array → show empty state, disable input and abort button
- No session creation from PWA in v1

#### UI Layout

**Header (fixed top):**

- App name: `port-hole`
- Status dot: green = connected, red = disconnected, yellow = reconnecting
- Session `<select>` dropdown
- Abort button — calls `POST /api/sessions/:id/abort` for current session

**Approval Panel (immediately below header, hidden when no pending approvals):**

- Show/hide using CSS `display: none` toggle — do not use visibility
- Background: amber `#92400e` or similar warning tone — must be visually distinct from chat
- Each pending approval card contains:
  - Description text from `entry.description`
  - Elapsed time since `entry.timestamp` formatted as `"waiting Xh Ym"` — recalculate and re-render every 60 seconds using `setInterval`
  - **Allow** button (green) and **Deny** button (red)
  - Each button shows `"Queued"` text and is disabled if action is queued pending reconnect
- Cards ordered most-recent-first (sort by `timestamp` descending)
- Card removed from DOM when resolved
- This panel must be fully visible without scrolling when approvals exist

**Chat View (scrollable, fills remaining vertical space):**

- Chronological order top to bottom
- User messages: right-aligned, `background: #1e3a5f`
- Assistant text: left-aligned, `background: #1a1a2e`
- Tool calls: `<details>` with `<summary>` showing tool name — collapsed by default
- Tool results: same `<details>` pattern — collapsed by default
- Code blocks: `<pre><code>` — `font-family: monospace`, `font-size: 14px`, `overflow-x: auto`, `white-space: pre` (never wrap), `background: #0d0d0d`, padding `8px`, and a copy button positioned `top: 4px right: 4px` inside a `position: relative` wrapper
- Timestamps: `HH:MM` format shown on each message item
- Auto-scroll: scroll to bottom on each new appended event, unless `chatContainer.scrollTop + chatContainer.clientHeight < chatContainer.scrollHeight - 50` — in that case the user has scrolled up, do not force scroll

**Input Area (fixed bottom):**

- `<textarea id="prompt-input">` — `rows="1"`, CSS `max-height` equivalent to 5 lines, `overflow-y: auto`
- `<button id="send-btn">Send</button>` to the right
- `keydown` listener: Enter without Shift → call send, `preventDefault`. Shift+Enter → insert newline normally.
- On successful send: clear textarea, re-enable input
- While send request is in flight: set textarea and button `disabled = true`
- On send failure: insert `<div class="send-error">Failed to send — <button>retry</button></div>` below textarea, re-enable input. Retry button calls send again with the same text.

#### Error States — all must be explicitly handled, no silent failures

| Situation                       | What to show                                                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/sessions` fails on load   | Full-screen overlay: "Cannot reach port-hole. Is the bridge server running?" with Retry button that calls location.reload()                  |
| SSE `onerror` fires             | Status dot → red. Banner below header: "Disconnected — reconnecting..." Hidden when `connected` event fires again                            |
| Prompt send returns non-2xx     | Inline error below textarea per input area spec above                                                                                        |
| Approval action returns non-2xx | Error text inside the approval card: "Action failed — try again". Re-enable Allow/Deny buttons                                               |
| `session.error` event arrives   | Append a message to chat in red: `"⚠ Session error: ${event.properties.error}"`                                                              |
| `/api/sessions` returns `[]`    | Show empty state in chat area: "No active sessions. Start a session in OpenCode on your PC." Disable textarea, send button, and abort button |

#### Service Worker (`pwa/sw.js`)

**The Service Worker handles reconnect status messaging only.** The browser `EventSource` reconnects automatically — the SW does not manage SSE reconnection.

**What it does:**

- Listens for `postMessage` from the main thread
- Main thread sends `{ type: 'sse-status', status: 'connected' | 'disconnected' }` via `navigator.serviceWorker.controller.postMessage(...)`
- SW relays this back to all clients via `self.clients.matchAll()` + `client.postMessage(...)`
- This allows other tabs to reflect connection status

**Action queue** lives in the **main thread**, not the Service Worker:

```javascript
// In index.html main thread JS
const actionQueue = [];
let isConnected = false;

async function sendAction(type, payload) {
  if (!isConnected) {
    actionQueue.push({ type, payload });
    showQueuedState(type, payload);
    return;
  }
  await executeAction(type, payload);
}

// When SSE 'connected' event fires:
isConnected = true;
while (actionQueue.length > 0) {
  const action = actionQueue.shift();
  try {
    await executeAction(action.type, action.payload);
  } catch (e) {
    showActionError(action);
    // continue draining — don't stop on one failure
  }
}
```

Queue is in-memory — does not survive page reload. This is acceptable and documented in limitations.

#### PWA Manifest (`pwa/manifest.json`)

```json
{
  "name": "port-hole",
  "short_name": "port-hole",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Add to `index.html` `<head>`:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta
  name="apple-mobile-web-app-status-bar-style"
  content="black-translucent"
/>
<meta name="apple-mobile-web-app-title" content="port-hole" />
```

**Icon files are a manual step — agents must not attempt to generate binary PNG files.**
Create `pwa/icon-192.png` and `pwa/icon-512.png` manually before running the app.
A simple solid-colour PNG is sufficient. Use any image editor, or generate with ImageMagick:

```powershell
magick -size 192x192 xc:#6366f1 pwa/icon-192.png
magick -size 512x512 xc:#6366f1 pwa/icon-512.png
```

Without these files the app works but the home screen icon will be a screenshot crop.

---

### 3.6 Development Steps for Agents

Execute strictly in this order. Do not proceed until each verification step passes.

---

**Step 1 — Project scaffold**

- Create directory structure per 3.1
- Init `server/package.json` with dependencies: `fastify`, `eventsource`, `dotenv`, `typescript`, `tsx`, `@types/node`, `uuid`, `@types/uuid`, `jest`, `@types/jest`, `ts-jest`, `playwright`, `@playwright/test`
- Create `server/tsconfig.json` per section 3.3 — `module: CommonJS`, `moduleResolution: Node`
- Create `server/jest.config.js` with Jest configuration
- Create `.env` in project root with: `OPENCODE_PORT=4096`, `BRIDGE_PORT=3000`, `OPENCODE_HOST=127.0.0.1`
- Create `.env.example` with the same content
- Create empty placeholder files for all `src/` modules with a single `export {}` so TypeScript doesn't complain
- Create `e2e/playwright.config.ts` with basic Playwright configuration

✅ **Verify:** `cd server && npm install` completes without errors. `npx tsc --noEmit` passes on placeholder files. `npm test` runs with no tests (empty suite).

---

**Step 2 — OpenCode client (`opencode.ts`)**

- Implement all methods per section 3.4
- `import EventSource from 'eventsource'` — npm package, not browser built-in
- `health()` uses `AbortController` with 2000ms timeout
- `subscribeToEvents` reconnects with 1 second delay, no maximum retries
- All TypeScript interfaces defined including `Session` with `updatedAt: number`

✅ **Verify:** With `opencode serve` running on port 4096, write a temporary test block at the bottom of `index.ts` that calls `health()`, `getSessions()`, subscribes to events and logs 5 then unsubscribes. All three work. Remove test block when done. Run `npm test -- --testPathPattern=opencode` to verify unit tests pass.

---

**Step 3 — Process manager (`process.ts`)**

- Check-first startup logic per section 3.4
- `child_process.spawn` with `{ shell: true }` — required on Windows
- stdout/stderr piped to write stream targeting `opencode.log` in project root
- Restart loop: 2 second delay, max 5 attempts, reset counter after 10 minute stable timer
- Exported `getStatus()` function and `processEvents` EventEmitter

✅ **Verify:** Start bridge with no OpenCode running — confirm `opencode.log` shows OpenCode output and `ready` is emitted. Kill the OpenCode process manually — confirm it restarts within 3 seconds and `ready` is emitted again. Run `npm test -- --testPathPattern=process` to verify unit tests pass.

---

**Step 4 — Store (`store.ts`)**

- Event log array and approval queue Map per section 3.4
- `addPendingApproval` is idempotent — duplicate `permissionId` is silently ignored
- `resolveApproval` throws on unknown `permissionId`
- No imports from other project modules

✅ **Verify:** Call `appendEvent` 10 times with mock data, confirm `getEventLog().length === 10`. Call `addPendingApproval` twice with the same `permissionId`, confirm `getPendingApprovals().length === 1`. Call `resolveApproval`, confirm entry no longer appears in `getPendingApprovals()`. Run `npm test -- --testPathPattern=store` to verify unit tests pass.

---

**Step 5 — Bridge (`bridge.ts`)**

- Connected clients Map using `reply.raw` per the Fastify SSE pattern in section 3.4
- `handleNewClient` writes history, approvals, connected events in sequence then registers close listener
- `broadcast` iterates clients, catches write errors, removes failed clients
- 30 second keepalive setInterval
- Imports `store.ts` only — no other project module imports

✅ **Verify:** Register a temporary `GET /stream` route manually in a test script. Open it in a browser. Confirm `history`, `approvals`, and `connected` events arrive immediately. Call `broadcast({ test: true })` — confirm the browser receives an `opencode` event. Run `npm test -- --testPathPattern=bridge` to verify unit tests pass.

---

**Step 6 — Routes (`routes.ts`)**

- All routes per section 3.4
- Static files served using `__dirname`-relative path to `pwa/` directory
- Input validation returns `400 { "error": "..." }` with exact messages specified
- All async handlers in try/catch — `OpenCodeError` returns its status, others return 500

✅ **Verify:** `curl http://localhost:3000/api/status` returns `{ opencodeStatus, connectedClients }`. `curl -X POST http://localhost:3000/api/sessions/x/prompt -H "Content-Type: application/json" -d '{}'` returns 400 with correct error message. Run `npm test -- --testPathPattern=integration` to verify integration tests pass.

---

**Step 7 — Entry point (`index.ts`)**

- `dotenv.config()` is the very first call before any other imports
- Full startup sequence per section 3.4
- Event subscription wiring block exactly as shown in dependency wiring section
- Tailscale IP detection using the subnet check function from section 3.4
- Graceful shutdown on SIGINT

✅ **Verify:** `npx tsx src/index.ts` starts cleanly and prints Local and Tailscale URLs. `GET /api/status` returns healthy. Ctrl+C shuts down without errors. Run `npm test` to verify all unit and integration tests pass with 80% coverage threshold.

---

**Step 8 — PWA Frontend (`pwa/index.html`)**

- Full single-file PWA per section 3.5
- On load sequence in exact order specified
- SSE uses browser `EventSource` with named event listeners as shown in spec
- Action queue lives in main thread as shown in spec — not in Service Worker
- All error states from the table handled explicitly
- Approval panel uses `display: none` toggle
- Auto-scroll with the exact scroll position check from spec
- Code blocks: 14px monospace, `overflow-x: auto`, `white-space: pre`, copy button

✅ **Verify on iPhone via Tailscale IP:**

- Pending approval card visible with Allow/Deny — tap Allow, card disappears
- Send a prompt — appears in chat, streams in real time
- Disconnect phone from WiFi — status dot turns red, banner appears. Reconnect — turns green, banner gone
- Run `npm run test:e2e` to verify Playwright E2E tests pass

---

**Step 9 — Service Worker (`pwa/sw.js`)**

- Listens for `postMessage` with `{ type: 'sse-status', status }` from main thread
- Broadcasts status to all clients via `self.clients.matchAll()`
- Does not manage SSE reconnection — that is handled by browser EventSource natively

✅ **Verify:** Main thread sends `{ type: 'sse-status', status: 'disconnected' }` — confirm SW relays it back to the main thread's `navigator.serviceWorker.onmessage` handler and status dot changes.

---

**Step 10 — Manifest and iOS polish**

- `manifest.json` per spec in section 3.5
- All `<meta>` tags added to `index.html` `<head>`
- Confirm `icon-192.png` and `icon-512.png` exist in `pwa/` (created manually per section 3.5 — not by agent)

✅ **Verify:** Safari → Share → Add to Home Screen → icon appears. Tap icon → app opens full screen with no Safari browser chrome.

---

## 4. Testing Strategy

### 4.1 Test Frameworks

- **Jest** - Unit and integration tests for server-side TypeScript modules
- **Playwright** - End-to-end tests for PWA functionality in real browsers

### 4.2 Test Structure

#### Unit Tests (`server/src/__tests__/unit/`)

- `opencode.test.ts` - Mock OpenCode API, test SSE reconnection, error handling
- `store.test.ts` - Test event log and approval queue operations
- `process.test.ts` - Mock child_process, test startup/restart logic
- `bridge.test.ts` - Mock Fastify response, test client management

#### Integration Tests (`server/src/__tests__/integration/`)

- `api-endpoints.test.ts` - Test all HTTP routes with real Fastify server
- `event-flow.test.ts` - Test OpenCode → store → bridge → client event flow

#### E2E Tests (`e2e/`)

- `pwa-basic.test.ts` - Test PWA UI, session management, prompt sending
- `reconnect.test.ts` - Test SSE reconnection, action queue, status updates

### 4.3 Jest Configuration

**`server/jest.config.js`:**

```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts"],
  coverageThreshold: { global: { branches: 80, functions: 80, lines: 80 } },
  testMatch: ["<rootDir>/src/**/*.test.ts"],
};
```

**Mock Strategy:**

- External APIs: Jest mocks
- File system: `fs` mock for logs
- Network: Mock HTTP servers for OpenCode API
- Time: `jest.useFakeTimers()` for timeouts/intervals

### 4.4 Package.json Scripts

```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:e2e": "playwright test",
  "test:all": "npm test && npm run test:e2e"
}
```

### 4.5 CI Integration

All tests must pass in CI before deployment:

- Unit/integration tests with 80% coverage
- E2E tests in multiple browsers
- No test execution should require manual OpenCode instances

---

## 5. Running the App

**One-time manual step before first run — create icon files:**

```powershell
magick -size 192x192 xc:#6366f1 pwa/icon-192.png
magick -size 512x512 xc:#6366f1 pwa/icon-512.png
```

If ImageMagick is not installed: `winget install ImageMagick.ImageMagick`

**Start bridge server:**

```powershell
cd port-hole/server
npx tsx src/index.ts
```

**Access from Phone:**
Open the Tailscale URL printed on startup in your browser. Add to home screen for best experience.

---

## 6. Known Limitations (v1)

- Event log and approval queue reset when bridge server restarts — history from before bridge started is not available on phone connect
- No push notifications — you must actively open the PWA to see waiting approvals
- Single OpenCode instance per bridge server
- No session creation from mobile — start sessions from your PC
- Action queue is in-memory in the main thread — lost on full page reload while disconnected
