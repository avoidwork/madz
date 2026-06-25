## Why

When a user sends a new message while the agent is streaming a response, an error message is displayed to the user instead of a clean "Interrupted." status. The root cause is a race condition between `handleChat()` and `handleInterrupt()` — both await the same `dispatchPromise`, and when the abort signal triggers, the error thrown doesn't always have `name === "AbortError"`, causing `handleChat()`'s catch block to treat it as a real error and display it to the user.

## What Changes

- Introduce a shared `isIntentionalAbort` ref in `src/tui/app.js` that `handleInterrupt()` sets to `true` before aborting, allowing `handleChat()`'s catch block to recognize intentional interruptions regardless of error type
- Add early abort signal check at function entry in `src/agent/react.js` to throw a named `AbortError` if the signal is already aborted when entering the streaming function
- Preserve all existing cleanup logic — the flag only affects error display, not cleanup behavior

## Capabilities

### New Capabilities
- `streaming-interruption`: Graceful handling of user-initiated streaming interruptions without error message display

### Modified Capabilities
<!-- None — no existing spec-level behavior changes -->

## Impact

- `src/tui/app.js` — `handleChat()` and `handleInterrupt()` functions, new ref
- `src/agent/react.js` — `callReactAgentStreaming()` function, early abort check
- No API changes, no dependency changes
- No breaking changes