# Update

## What was fixed in this iteration

### Live session pickup
- Added automatic session refresh in the PWA every 3 seconds.
- Kept the manual refresh button in the top bar.
- Added `sessionSelectionMode` so the app can distinguish between:
  - `auto` selection
  - `manual` user selection
- Result: newly created OpenCode sessions should now appear in the PWA without restarting it.

### Feed/history correctness
- Fixed SSE `history` handling so raw event-log entries are no longer pushed into `messages` state.
- `history` now triggers a proper refresh for the selected session.

### Feed scroll behavior
- Kept the feed scrollable.
- Restored “always scroll to the latest message” behavior by auto-scrolling the scroll container on message/session changes.

### Cleanup and stability
- Removed unused imports in frontend components.
- Reduced noisy runtime debug logging.
- Fixed an existing backend TypeScript issue in `server/src/process.ts`.
- Capped the in-memory server event history to avoid unbounded growth.

## Requested feature feasibility findings

I used the runtime/API findings preserved in the **`Port-hole OpenCode runtime capabilities`** memory when writing this section.

### 1. Show currently selected model
- **Finding:** Likely possible.
- **Why:** Raw OpenCode message payloads include model metadata such as:
  - `info.model.providerID`
  - `info.model.modelID`
  - `info.providerID`
  - `info.modelID`
- **Implication:** The bridge can expose current-model info for the selected session if we preserve that metadata when normalizing messages or add a dedicated endpoint.

### 2. Add a model select box in the PWA
- **Finding:** Partially possible.
- **What is confirmed:**
  - OpenCode exposes providers/models through `/provider`.
  - So listing available models in the PWA is feasible.
- **What is not confirmed yet:**
  - I did **not** verify a stable HTTP endpoint in this local OpenCode runtime that changes the active model for the currently selected session/CLI context.
- **Conclusion:**
  - **Model list UI:** feasible
  - **Actually switching the OpenCode CLI session model from the bridge:** **not yet confirmed** in this runtime

### 3. Show current context / tokens used
- **Finding:** Likely possible.
- **Why:** Assistant message payloads include token usage data such as:
  - `tokens.total`
  - `tokens.input`
  - `tokens.output`
  - `tokens.reasoning`
  - cache read/write stats
- **Implication:** The bridge can surface current usage/context stats to the PWA.
- **Caveat:** We still need to decide the exact UX:
  - latest assistant response only
  - rolling session total
  - currently selected turn

## Changed files

### Code files changed
- `pwa-react/src/components/ChatInterface.jsx`
- `pwa-react/src/components/MessageList.jsx`
- `pwa-react/src/components/PromptInput.jsx`
- `pwa-react/src/components/TopBar.jsx`
- `pwa-react/src/hooks/useAPI.js`
- `pwa-react/src/hooks/useSSE.js`
- `pwa-react/src/stores/appStore.js`
- `server/src/opencode.ts`
- `server/src/process.ts`
- `server/src/store.ts`

### Documentation files added/changed
- `ANALYSIS.md`
- `UPDATE.md`

## Verification performed
- `npm run build` in `pwa-react` ✅
- `npm run typecheck` in `server` ✅
- Runtime API inspection for:
  - `/session`
  - `/session/:id/message`
  - `/session/current`
  - `/provider`

## Recommended next step
- If you want, I can do the next iteration focused only on **model/context visibility**:
  - expose current model in the bridge
  - expose token/context stats in the bridge
  - add read-only UI in the top bar
- I would keep model switching itself behind a second step until we confirm the exact runtime API for changing the model.
