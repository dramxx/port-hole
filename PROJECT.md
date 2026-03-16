# port-hole — PROJECT.md

> **Technical documentation for AI models working on this project**

## Project Overview

port-hole is a remote control interface for OpenCode running on a home PC, accessible from an iPhone PWA via a secure Tailscale tunnel. It enables sending prompts, monitoring agent activity in real-time, and resolving pending approvals from anywhere.

## Architecture

```
OpenCode HTTP API (localhost:4096)
         ↕  localhost only
Bridge Server (0.0.0.0:3000)
         ↕  Tailscale private network
iPhone Safari PWA
```

### Components

- **Bridge Server** — Node.js/TypeScript process managing OpenCode, storing event history, relaying events to connected phones
- **PWA Frontend** — React-based progressive web app running in iPhone Safari
- **OpenCode** — AI coding assistant with HTTP API and SSE event streaming

## Project Structure

```
port-hole/
├── server/                     # Bridge server (Node.js/TypeScript)
│   ├── src/
│   │   ├── __tests__/         # Jest test files
│   │   ├── index.ts          # Entry point
│   │   ├── process.ts        # OpenCode process manager
│   │   ├── opencode.ts       # OpenCode API client + SSE subscription
│   │   ├── store.ts          # Event log + approval queue (in-memory)
│   │   ├── bridge.ts         # SSE relay to phone clients
│   │   └── routes.ts         # All HTTP routes
│   ├── tsconfig.json
│   ├── jest.config.js
│   └── package.json
├── pwa-react/                 # React PWA frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── stores/          # Zustand state management
│   │   ├── App.jsx          # Main app component
│   │   ├── main.jsx         # Entry point
│   │   └── index.css        # Tailwind CSS
│   ├── index.html
│   ├── package.json
│   └── tailwind.config.js
├── e2e/                      # Playwright E2E tests
└── PROJECT.md                # This file
```

## Technology Stack

### Backend (Bridge Server)
- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript
- **HTTP Framework**: Fastify
- **SSE Client**: `eventsource` npm package
- **Config**: `dotenv` npm package
- **Testing**: Jest

### Frontend (PWA)
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Icons**: Lucide React
- **Service Worker**: Native browser API

### Testing
- **Unit/Integration**: Jest
- **E2E**: Playwright

## OpenCode HTTP API

### Base Configuration
- **Host**: `127.0.0.1` (localhost only)
- **Port**: `4096`
- **Authentication**: Optional password via `OPENCODE_SERVER_PASSWORD`

### Key Endpoints

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| `GET` | `/global/health` | Health check, version |
| `GET` | `/event` | SSE stream — all real-time events |
| `GET` | `/session` | List all sessions |
| `GET` | `/session/:id` | Get session details |
| `GET` | `/session/:id/message` | Full message history for a session |
| `POST` | `/session/:id/message` | Send prompt, waits for full response |
| `POST` | `/session/:id/prompt_async` | Send prompt, returns 204 immediately |
| `POST` | `/session/:id/permissions/:permissionID` | Approve or reject permission request |
| `POST` | `/session/:id/abort` | Abort a running session |

### Request Payloads

**Send Prompt:**
```json
POST /session/:id/prompt_async
{
  "parts": [
    { "type": "text", "text": "your prompt text here" }
  ]
}
```

**Permission Approval:**
```json
POST /session/:id/permissions/:permissionID
{
  "response": "allow",
  "remember": false
}
```

### SSE Event Stream

**Event Structure:**
```
data: {"type": "message.part.updated", "properties": { ... }}
```

**Event Types:**
| `type` | When it fires | Fields in `properties` |
| ------ | ------------- | ---------------------- |
| `session.updated` | Session state changes | `sessionId`, `status` |
| `message.part.updated` | Model streaming response | `sessionId`, `messageId`, `part` |
| `permission.asked` | OpenCode wants approval | `sessionId`, `permissionId`, `description` |
| `session.error` | Error occurred | `sessionId`, `error` |

## Bridge Server Architecture

### Module Dependencies
- **`index.ts`** is the only wiring point - no circular dependencies between other modules
- **Event Flow**: OpenCode → Store → Bridge → Phone Clients

### Key Modules

#### `process.ts` - OpenCode Process Manager
- Ensures OpenCode HTTP server is running
- Auto-restart on crash (with backoff)
- Health check polling
- Status tracking: `starting | running | restarting | fatal`

#### `opencode.ts` - OpenCode API Client
- Typed wrapper around OpenCode HTTP API
- SSE event subscription with auto-reconnect
- Error handling with `OpenCodeError` class
- All API communication goes through this module

#### `store.ts` - Event Log & Approval Queue
- **Event Log**: In-memory array of all OpenCode events with UUIDs and timestamps
- **Approval Queue**: Map of pending permission requests with state tracking
- Provides history for late-connecting clients

#### `bridge.ts` - Phone Client SSE Relay
- Maintains connected phone clients
- Sends full history on new connections
- Relays live events to all connected clients
- 30-second keepalive pings

#### `routes.ts` - HTTP Routes
- Static file serving for PWA
- API endpoints for frontend
- Input validation and error handling
- No CORS (same origin)

### Environment Variables

```bash
OPENCODE_PORT=4096
BRIDGE_PORT=3000
OPENCODE_HOST=127.0.0.1
OPENCODE_SERVER_PASSWORD=optional_password
```

## Frontend Architecture

### React Components

#### `App.jsx`
- Root component with TopBar and ChatInterface
- Manages SSE connection lifecycle

#### `TopBar.jsx`
- Fixed positioning header with two rows:
  - **Row 1**: port-hole logo + connection status
  - **Row 2**: Session selector + Model selector
- Always on top with `z-50`

#### `ChatInterface.jsx`
- Main interface container
- Handles loading/error states
- Renders ApprovalPanel, MessageList, PromptInput

#### `StatusIndicator.jsx`
- Connection status with icons (Wifi, WifiOff, AlertCircle, Loader2)
- Color-coded: green (connected), yellow (reconnecting), red (error), gray (disconnected)

#### `MessageList.jsx`
- Chat message display
- Auto-scroll with user scroll detection
- Code blocks with copy functionality
- Tool calls as collapsible details

#### `ApprovalPanel.jsx`
- Pending permission requests
- Amber warning background
- Allow/Deny buttons with queuing
- Auto-refresh elapsed time

#### `PromptInput.jsx`
- Textarea with auto-resize
- Enter to send, Shift+Enter for newline
- Send state management and error handling

### State Management (Zustand)

```javascript
// Connection state
isConnected: boolean
status: 'disconnected' | 'connected' | 'reconnecting' | 'error'

// Session state
sessions: Session[]
currentSessionId: string | null
messages: Message[]

// Model state
availableModels: Model[]
currentModelId: string | null

// Approval state
approvals: Map<string, Approval>

// UI state
promptInput: string
isSending: boolean
```

### Custom Hooks

#### `useSSE`
- EventSource connection management
- Event parsing and state updates
- Auto-reconnect handling
- Service worker communication

#### `useAPI`
- HTTP request wrapper
- Error handling and loading states
- Session and message fetching

### Styling

**TailwindCSS Configuration:**
```javascript
colors: {
  dark: {
    DEFAULT: '#0a0a0a',
    secondary: '#1a1a1a',
    tertiary: '#2a2a2a',
    border: '#333333',
    text: '#e0e0e0',
    muted: '#888888'
  }
}
```

**Custom CSS:**
- Dark theme throughout
- Custom scrollbar styling
- Responsive design for mobile

## PWA Features

### Service Worker (`sw.js`)
- Background reconnect status messaging
- Cross-tab communication
- No SSE management (handled by browser)

### Manifest Configuration
- iOS home screen support
- App icons (192x192, 512x512)
- Standalone display mode

## Network Configuration

### Tailscale Setup
- Private network between PC and phone
- CGNAT range: `100.64.0.0/10`
- IP detection in bridge server startup

### Firewall Rules
Windows PowerShell (admin):
```powershell
New-NetFirewallRule -DisplayName "port-hole Bridge" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

## Development Workflow

### Running the Project
1. Start OpenCode HTTP server: `opencode serve --hostname 127.0.0.1 --port 4096`
2. Start bridge server: `cd server && npx tsx src/index.ts`
3. Start PWA dev server: `cd pwa-react && npm run dev`
4. Access via Tailscale IP: `http://100.x.x.x:3000`

### Testing
- Unit tests: `cd server && npm test`
- E2E tests: `npx playwright test`
- PWA testing: Use browser dev tools for mobile simulation

### TypeScript Configuration
- Runtime via `tsx` (no compilation step)
- `module: CommonJS`, `moduleResolution: Node`
- `__dirname` for static file paths
- `tsc --noEmit` for type checking only

## Security Considerations

- OpenCode never exposed to network (localhost only)
- Bridge server serves PWA from same origin
- Tailscale provides encrypted tunnel
- Optional password protection for OpenCode
- No CORS headers needed (same origin)

## Error Handling

### Frontend Error States
- Connection errors: Full-screen overlay with retry
- SSE errors: Status indicator + reconnect banner
- Send failures: Inline error with retry button
- Approval failures: Error text in approval card

### Backend Error Handling
- OpenCode API errors: `OpenCodeError` with status codes
- Process crashes: Auto-restart with backoff
- Client disconnects: Automatic cleanup
- Invalid requests: 400 responses with error messages

## Performance Notes

- Event log stored in memory (resets on restart)
- SSE events broadcast to all clients
- PWA uses virtual scrolling for large chat histories
- Service worker for offline status updates
- Lazy loading of message history
