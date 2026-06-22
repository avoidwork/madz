## Context

The TUI (text-based user interface) layer in `src/tui/app.js` handles conversation streaming and interruption. When a user interrupts a conversation (via escape key, kill signal, or disconnect), an `AbortError` is thrown. The current error handlers in two locations (lines ~506-529 and ~906-925) unconditionally call `checkpointer.deleteThread(threadId)`, which permanently deletes the conversation checkpoint. This prevents the user from resuming their conversation from the point of interruption.

The checkpointer module manages conversation persistence, storing checkpoints that allow users to resume conversations later. The `deleteThread(threadId)` method is the only way to permanently remove a checkpoint.

## Goals / Non-Goals

**Goals:**
- Preserve conversation checkpoints when interruptions occur (AbortError)
- Allow users to resume conversations from the exact point of interruption
- Maintain existing explicit quit behavior (e.g., `:q` command still deletes the thread)

**Non-Goals:**
- Changing the checkpointer implementation or API
- Adding new state management for interrupted conversations
- Handling other error types (non-AbortError)
- Implementing automatic cleanup of abandoned checkpoints

## Decisions

### Decision 1: Remove deleteThread call from AbortError handlers
**Choice:** Remove the `checkpointer.deleteThread(threadId)` call from both AbortError handlers in `src/tui/app.js`.

**Rationale:** The AbortError is triggered by user-initiated interruptions, not by failures that would corrupt the conversation state. The checkpoint is already saved before the interruption occurs, so there's no need to delete it. The user should be able to resume.

**Alternatives considered:**
- Make the delete conditional on error type: More complex, adds branching logic for a simple fix.
- Add a "save interrupted state" mechanism: Unnecessary — the existing checkpoint mechanism already handles this.
- Delete after a timeout: Adds complexity and doesn't solve the core problem of user resumption.

### Decision 2: Preserve explicit quit behavior
**Choice:** Do not modify the explicit quit handlers (`handleQuit()`). These already have separate logic that correctly deletes the thread.

**Rationale:** The existing code already distinguishes between AbortError (interruption) and explicit quit. The quit handlers are in different code paths and should continue to delete the thread as expected.

## Risks / Trade-offs

### Risk: Accumulation of abandoned checkpoints
**Mitigation:** The existing cleanup mechanisms (thread expiration, manual cleanup) will handle this. Users who interrupt and never resume will have orphaned checkpoints, but this is acceptable — the system already has mechanisms to handle this.

### Risk: Accidental state preservation in other error paths
**Mitigation:** Only the AbortError handlers are being modified. Other error handlers (e.g., network errors, provider errors) are not affected and will continue to behave as before.

### Trade-off: Slightly larger disk usage over time
**Mitigation:** Negligible for most users. Checkpoints are small, and existing cleanup mechanisms will eventually remove them.

## Open Questions

- None at this time. The fix is straightforward and well-scoped.