# Proposal

## Why

In the TUI, message bubbles render a localized short-form time (e.g., "10:39 AM") during a live conversation, but re-loaded sessions render the raw ISO8601 timestamp (e.g., "2026-11-06T07:28:03.000Z"). The timestamp formatting is applied at the live call site but never applied to session-restored messages, so the two paths diverge and re-loaded sessions look inconsistent.

## What Changes

- **MessageBubble** now accepts a raw timestamp (a `Date` or an ISO8601 string) via the `time` prop and formats it at render time using `formatTime()`, instead of rendering the prop verbatim. Invalid or missing timestamps fall back to `formatTime(new Date())`.
- The live path in `conversationArea.js` is updated to pass a raw timestamp (a `Date`) rather than a pre-formatted string, so both live and restored messages converge on the same contract.
- The session-restore paths (mount effect and `loadConversation`) already pass `exchange.timestamp` (ISO8601), which now renders correctly once the bubble formats it.
- No change to `stateManager.js` storage — ISO8601 remains the source of truth; formatting is purely a display concern.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `component-message-bubbles`: The MessageBubble timestamp rendering requirement changes. The `time` prop contract changes from "pre-formatted localized string" to "raw timestamp (Date or ISO8601 string) formatted at render time", so live and re-loaded sessions render identically.

## Impact

- `src/tui/messageBubble.js` — the `time` prop handling (line 393) and `formatTime` import.
- `src/tui/conversationPanel.js` — the `formatTime` export (unchanged).
- `src/tui/conversationArea.js` — the live path (`getTimestamp`, `addMessage`) and the session-restore paths (mount effect, `loadConversation`).
- `src/session/stateManager.js` — ISO8601 timestamp storage (unchanged).

## Non-goals

- Changing how timestamps are stored in session state (ISO8601 storage is preserved).
- Altering the locale or timezone formatting behavior of `formatTime`.
- Any change to the SUBAGENTS panel rendering path beyond ensuring the `time` prop contract is honored.
