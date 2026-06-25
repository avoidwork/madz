## Context

The TUI chat interface streams agent responses in real-time. When a user sends a new message while a response is streaming, the system must gracefully cancel the current stream and begin processing the new message. Currently, this interruption causes an error message to be displayed to the user because:

1. `handleChat()` and `handleInterrupt()` both await the same `dispatchPromise`
2. When the abort signal triggers, the error thrown may not have `name === "AbortError"`
3. `handleChat()`'s catch block treats unrecognized errors as real errors and displays them

The relevant code paths:
- `src/tui/app.js:904-927` — `handleChat()` catch block checks `err.name === "AbortError"`
- `src/tui/app.js:947-985` — `handleInterrupt()` aborts and awaits `dispatchPromise`
- `src/agent/react.js:263-276` — Abort signal check inside `for await` loop

## Goals / Non-Goals

**Goals:**
- Ensure intentional interruptions (user sends new message during streaming) never show an error to the user
- Recognize interruptions regardless of the error type thrown by the abort signal
- Preserve all existing cleanup behavior (tool-call removal, message clearing, flag reset)

**Non-Goals:**
- Changing the streaming protocol or LLM provider integration
- Modifying session management or compaction logic
- Handling network errors or LLM API errors during streaming (those should still show errors)

## Decisions

### Decision 1: Use a shared ref flag instead of error type detection
**Choice:** Introduce `isIntentionalAbort` ref in `src/tui/app.js`
**Rationale:** Error types vary across Node.js environments (DOMException, custom LangChain errors, AbortError). Checking error names is fragile and environment-dependent. A shared ref is explicit, deterministic, and doesn't rely on error type matching.
**Alternatives considered:**
- Checking multiple error names (`"AbortError"`, `"Canceled"`, etc.) — fragile, may miss new error types
- Wrapping the abort in a custom error class — still requires error type propagation through async boundaries
- Using a Promise-based signaling mechanism — over-engineered for a single boolean state

### Decision 2: Set the flag before aborting, not after
**Choice:** Set `isIntentionalAbort.current = true` before calling `abortController.abort()`
**Rationale:** Ensures the flag is set even if `abort()` throws (unlikely but possible). The flag is reset in `handleChat()`'s `finally` block, guaranteeing cleanup regardless of execution path.
**Alternatives considered:**
- Setting after abort — race condition if abort throws
- Using a separate signaling Promise — adds complexity without benefit

### Decision 3: Add early abort check in react.js
**Choice:** Check `signal.aborted` at function entry in `callReactAgentStreaming()` and throw a named `AbortError` if already aborted
**Rationale:** Provides a second layer of defense — even if the ref flag isn't checked for some reason, the error thrown will have the correct name. This is a belt-and-suspenders approach.
**Alternatives considered:**
- Relying solely on the ref flag — sufficient but less defensive
- Checking only inside the for-await loop — misses errors thrown during stream initialization

## Risks / Trade-offs

[Risk] The ref flag approach adds state that must be carefully managed across async boundaries → [Mitigation] The flag is set in a synchronous code path (handleInterrupt) and checked in the catch block of the same async function (handleChat), minimizing race conditions. Reset in finally ensures cleanup.

[Risk] Adding an early abort check in react.js could mask legitimate errors if the signal is aborted for unexpected reasons → [Mitigation] The ref flag provides the primary decision path; the named AbortError is secondary. The ref flag is only set by handleInterrupt(), which is the intentional abort path.

[Risk] The change is tightly coupled to the current TUI architecture → [Mitigation] The fix is localized to two files and doesn't change the streaming protocol or provider interface. If the TUI architecture changes, the fix can be adapted without affecting other systems.