## Context

When a tool execution is interrupted mid-execution in the TUI, the system throws an unrecoverable 400 error: "System message must be at the beginning." This error originates from the OpenAI API, which strictly requires the system message to be the first element in the conversation messages array.

The current interruption flow in `src/tui/app.js` uses an AbortController to signal tool interruption. The `handleInterrupt()` function signals the abort controller and awaits the dispatch promise. The try/catch around dispatchProvider calls handles AbortError gracefully but allows other errors (like the 400) to fall through to an unrecoverable error display.

The root cause is that when a tool is interrupted, the conversation state may be left in an inconsistent state — for example, a tool result message may have been partially added to the conversation array before the system message, or the conversation array may have been corrupted during the abort process. Subsequent API calls then fail because the system message is no longer first.

## Goals / Non-Goals

**Goals:**
- Ensure conversation state is valid (system message first) after any interruption
- Gracefully handle non-AbortError errors that occur during active interruption
- Allow the user to continue the conversation normally after an interruption
- Add spec requirement for graceful interruption error handling

**Non-Goals:**
- Changes to the TUI interrupt UI/UX (escape key behavior, visual feedback)
- Changes to the AbortController mechanism itself
- Changes to LLM provider configuration or API keys
- Conversation checkpoint persistence (already covered by existing spec)

## Decisions

### Decision 1: Use an `isInterrupting` state flag
**Choice:** Add an `isInterrupting` boolean flag to track when an interruption is in progress.
**Rationale:** This allows the error handler to distinguish between a normal error and an error that occurred during interruption. Without this flag, any error during tool execution would be indistinguishable from an interruption error.
**Alternatives considered:**
- Check if the error is an AbortError — but the 400 error is not an AbortError, it's a regular error from the API
- Use a try/catch around the entire interruption flow — but this would mask real errors that occur after interruption

### Decision 2: Reset conversation state on interruption
**Choice:** When an interruption occurs, reset the conversation to a clean state (system message + any messages that were fully completed before the interrupted tool).
**Rationale:** This is safer than trying to partially roll back the conversation. The interrupted tool's result is incomplete and should not be preserved.
**Alternatives considered:**
- Reorder messages to ensure system message is first — but this doesn't address the root cause and could leave other inconsistencies
- Clear the entire conversation — too aggressive, loses valid conversation history

### Decision 3: Catch errors during interruption in the outer try/catch
**Choice:** In the try/catch around dispatchProvider calls, check the `isInterrupting` flag and handle errors gracefully if true.
**Rationale:** This ensures that errors occurring during the interruption window are not displayed as unrecoverable errors.
**Alternatives considered:**
- Add a separate try/catch around the interruption handling — but this would duplicate error handling logic
- Let the error propagate and handle it at a higher level — but there is no higher level that knows about interruption state

## Risks / Trade-offs

### Risk: Race condition with rapid interruptions
**Mitigation:** The `isInterrupting` flag is set before the abort signal is sent and cleared after the dispatch promise resolves. Rapid interruptions will be serialized by the promise chain.

### Risk: Conversation state reset loses valid messages
**Mitigation:** Only messages that were fully completed before the interrupted tool are preserved. Partial tool results are discarded, which is the correct behavior.

### Risk: New error handling masks real bugs
**Mitigation:** The `isInterrupting` flag ensures that only errors during active interruption are handled gracefully. Errors that occur after interruption completes will still be displayed normally.

## Migration Plan

This is a bug fix with no migration required. The changes are:
1. Add `isInterrupting` flag to the TUI app state
2. Modify `handleInterrupt()` to set the flag and reset conversation state
3. Modify the try/catch around dispatchProvider to check the flag
4. Add new requirement to tui-conversation spec

No database migrations, config changes, or user-facing changes beyond the fix itself.

## Open Questions

- Should the conversation reset preserve tool results that were fully completed before the interruption? (Decision: Yes, preserve completed tool results)
- Is there a way to detect if the conversation state is already corrupted before making an API call? (Decision: Add a guard in the provider to reorder messages if needed, as a safety net)