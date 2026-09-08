## Why

The status bar context window size counter (`contextSize`) in the TUI is inaccurate due to two bugs in `src/tui/conversationArea.js`: a duplicate user exchange in `handleChat` inflates the token count, and `handleCommand` never calls `updateContextSize` after a skill response completes, leaving the counter stale. This undermines user trust in the displayed token usage and makes it difficult to track context window consumption accurately.

## What Changes

- Remove duplicate `sessionState.addExchange({ role: "user", content: text })` call in `handleChat` (line 463)
- Add `updateContextSize(sessionState, config)` call after user exchange in `handleCommand` skill path (line 202)
- Add `updateContextSize(sessionState, config)` call after assistant exchange in `handleCommand` skill path (line 317)

## Capabilities

### New Capabilities
- *(none — this is a bug fix, not a new capability)*

### Modified Capabilities
- *(none — no spec-level behavior changes; this is an internal fix to the TUI display logic)*

## Impact

- **File modified:** `src/tui/conversationArea.js` — one line removed, two lines added
- **No API changes, no new dependencies, no breaking changes**
- The fix aligns `handleCommand` with the existing `handleChat` pattern for context size tracking
