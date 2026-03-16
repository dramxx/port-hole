# Analysis

## Review Scope

Reviewed:

- `pwa-react/src/App.jsx`
- `pwa-react/src/components/TopBar.jsx`
- `pwa-react/src/components/ChatInterface.jsx`
- `pwa-react/src/components/MessageList.jsx`
- `pwa-react/src/components/PromptInput.jsx`
- `pwa-react/src/hooks/useAPI.js`
- `pwa-react/src/hooks/useSSE.js`
- `pwa-react/src/stores/appStore.js`
- `server/src/routes.ts`
- `server/src/opencode.ts`
- `server/src/store.ts`
- `server/src/bridge.ts`
- `server/src/index.ts`
- `server/src/process.ts`

## Findings

### A1. New OpenCode sessions were not picked up live in the PWA

- **Status:** Resolved
- **Severity:** High
- **Original evidence:** `fetchSessions()` only ran on initial mount and manual refresh.
- **Fix applied:** Added background session refresh in `ChatInterface` every 3 seconds and kept manual refresh in `TopBar`.
- **Verification:** Frontend build passes. Logic now refreshes the session list without a reload.
- **Notes:** This makes new sessions appear live. Exact real-time “follow the CLI-selected session immediately on the same event tick” is still limited by the runtime not exposing a confirmed current-session endpoint.

### A2. SSE `history` handling was structurally wrong

- **Status:** Resolved
- **Severity:** High
- **Original evidence:** `bridge.ts` sent raw event-log entries as `history`, while `useSSE.js` wrote them directly into `messages`.
- **Fix applied:** `useSSE.js` now treats `history` as a signal to refresh the selected session’s messages instead of replacing `messages` with raw event-log objects.
- **Verification:** Frontend build passes with corrected logic.

### A3. Session sync logic preserved stale selection forever

- **Status:** Resolved
- **Severity:** Medium
- **Original evidence:** `fetchSessions()` preserved the current selected session whenever it still existed.
- **Fix applied:** Added `sessionSelectionMode` to the store. Auto-refresh now prefers the latest session only while selection is still in `auto` mode. Manual dropdown changes switch the mode to `manual`.
- **Verification:** Store and API hook now support `auto` vs `manual` selection flow.
- **Notes:** This is a heuristic, not a true “current CLI session” API sync.

### A4. `useAPI()` is instantiated independently in multiple components

- **Status:** Open
- **Severity:** Medium
- **Evidence:** `TopBar`, `ChatInterface`, `PromptInput`, and `ApprovalPanel` each call `useAPI()`, creating separate local `isLoading`, `error`, and request refs.
- **Impact:** API request state is fragmented across components.
- **Recommendation:** Refactor later into shared store state or a shared query layer. This did not block the current fixes.

### A5. Debug logging and leftover implementation noise in runtime code

- **Status:** Partially resolved
- **Severity:** Low
- **Fixes applied:** Removed the noisy `history` console log from `useSSE.js`. Removed verbose prompt request/response logs from `server/src/opencode.ts`.
- **Remaining logs:** Actionable `console.error` for malformed SSE parse failures remain, which is acceptable.

### A6. Minor component hygiene issues

- **Status:** Resolved
- **Severity:** Low
- **Fix applied:** Removed unused React imports from `MessageList.jsx` and unused Lucide imports from `PromptInput.jsx`.
- **Verification:** Frontend build passes.

### A7. Event log grew without bounds on the server

- **Status:** Resolved
- **Severity:** Low
- **Fix applied:** Added a cap of 500 entries in `server/src/store.ts`.
- **Verification:** Server typecheck passes.

### A8. Existing backend typecheck issue in `server/src/process.ts`

- **Status:** Resolved
- **Severity:** Medium
- **Evidence:** `npm run typecheck` failed because `error` in `catch` was `unknown` and code accessed `error.message`.
- **Fix applied:** Narrowed the caught value with `error instanceof Error ? error.message : String(error)`.
- **Verification:** `npm run typecheck` now passes.

## Runtime/API findings relevant to requested follow-up

### F1. Current session endpoint

- Tested `GET http://localhost:4096/session/current`.
- Runtime response was `400` with validation expecting a regular session id.
- **Finding:** This runtime does **not** expose a usable current-session endpoint at that path.

### F2. Session list payload

- Tested `GET http://localhost:4096/session`.
- Payload includes fields such as `id`, `directory`, `title`, `projectID`, and `time`.
- **Finding:** No obvious `current` or `active` marker was present in the inspected response.

### F3. Model metadata availability

- Tested `GET http://localhost:4096/session/:id/message`.
- Raw message payloads include model metadata:
  - user messages can include `info.model.providerID` and `info.model.modelID`
  - assistant messages can include `info.providerID` and `info.modelID`
- **Finding:** Showing the currently used model in the PWA is feasible if the bridge preserves this metadata.

### F4. Token/context usage availability

- Assistant message payloads include `info.tokens` and `step-finish.tokens` with fields like `total`, `input`, `output`, `reasoning`, and cache stats.
- **Finding:** Showing current token/context usage is feasible if the bridge exposes these values to the PWA.

### F5. Model selection feasibility

- `GET /provider` exposes providers and models.
- External/current docs indicate model selection exists in the CLI and newer upstream work exists around API-side model selection.
- **Finding:** Listing available models in the PWA is feasible. However, I did **not** verify a stable runtime HTTP endpoint in this local OpenCode instance for changing the active session model from the bridge. That part remains unconfirmed.

## Verification

### Commands run

- `npm run build` in `pwa-react`
- `npm run typecheck` in `server`
- `GET http://localhost:4096/session`
- `GET http://localhost:4096/session/:id/message`
- `GET http://localhost:4096/session/current`

### Results

- **Frontend build:** Pass
- **Backend typecheck:** Pass
- **Known bug status:** Addressed in code via automatic session refresh and improved selection behavior

## Iteration Log

- Wrote initial review.
- Fixed live session refresh.
- Fixed broken SSE history-to-messages mapping.
- Added auto/manual session selection mode.
- Restored “always scroll to latest message” behavior while keeping a scrollbar.
- Cleaned unused imports and reduced noisy debug logging.
- Fixed existing backend TypeScript error uncovered by testing.
