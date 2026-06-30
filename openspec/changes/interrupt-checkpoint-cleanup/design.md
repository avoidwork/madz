## Context

The madz application uses LangGraph for state machine management of AI conversations. When a user interrupts a tool call (e.g., via command or cancel), the cleanup process only removes messages from in-memory state (`sessionState.#state.conversation`) but does not update the LangGraph checkpoint. The checkpoint, written at superstep boundaries by `createReactAgentGraph`, retains partial AIMessages with tool_calls. On resume, `streamEvents` replays from the checkpoint, causing orphaned tool calls to corrupt the resumed turn.

The current codebase has two interrupt paths:
- `handleChat()` in `app.js` (lines 922-924): calls both `removeLastAssistantToolCallMessage()` and `popExchange()`
- `handleCommand()` in `app.js` (lines 524-526): only calls `popExchange()` — missing tool call cleanup

The `removeLastAssistantToolCallMessage()` function in `stateManager.js` (lines 80-88) only modifies the in-memory conversation array.

## Goals / Non-Goals

**Goals:**
- Propagate checkpoint cleanup when in-memory state is cleaned on interrupt
- Ensure consistent cleanup across both `handleChat()` and `handleCommand()` interrupt paths
- Implement checkpoint reconciliation before resume to ensure state consistency
- Add integration test to verify the fix

**Non-Goals:**
- Refactoring the entire checkpoint management system
- Changing the LangGraph graph structure or state machine logic
- Adding new interrupt mechanisms or signals
- Handling checkpoint corruption beyond the specific orphaned tool call case

## Decisions

### Decision 1: Extend `removeLastAssistantToolCallMessage()` to accept an optional checkpointer

**Choice:** Modify `removeLastAssistantToolCallMessage()` to accept an optional `checkpointer` parameter. When provided, after removing the message from in-memory conversation, also update the checkpoint.

**Rationale:** This keeps the cleanup logic centralized in `stateManager.js` where it already lives. The checkpointer parameter is optional to maintain backward compatibility with existing callers that don't need checkpoint cleanup.

**Alternatives considered:**
- Create a separate `cleanupCheckpoint()` function: More explicit but duplicates the message identification logic
- Pass checkpointer to all stateManager methods: Over-engineered, most methods don't need it

### Decision 2: Use `checkpointer.put()` with cleaned state for checkpoint update

**Choice:** After removing the orphaned message from in-memory state, call `checkpointer.put()` with the cleaned conversation state to update the checkpoint.

**Rationale:** The LangGraph JS checkpointer API provides `put()` for writing state tuples. By putting a cleaned state tuple, we effectively replace the checkpoint state with the cleaned version.

**Alternatives considered:**
- Use `checkpointer.update()`: May not be available in the JS variant, or may have different semantics
- Delete specific checkpoint entries: More complex, requires knowing the exact checkpoint entry IDs

### Decision 3: Add reconciliation step before `dispatchProvider` after interrupt

**Choice:** Before calling `dispatchProvider` after an interrupt, add a reconciliation step that compares the checkpoint state with in-memory conversation. If they diverge, write the cleaned state to the checkpoint.

**Rationale:** This provides a safety net for cases where checkpoint cleanup might fail or be incomplete. It ensures the graph always resumes from a consistent state.

**Alternatives considered:**
- Rely solely on checkpoint cleanup during interrupt: Less robust, no fallback if cleanup fails
- Always reset the checkpoint on resume: Too aggressive, might lose valid state

### Decision 4: Graceful degradation if checkpoint cleanup fails

**Choice:** If checkpoint cleanup fails (e.g., checkpointer not available, API error), log a warning but continue with in-memory cleanup. The checkpoint inconsistency is a bug but not a crash.

**Rationale:** The in-memory cleanup still prevents the most obvious user-facing issues (duplicate messages in conversation). The checkpoint inconsistency can be addressed by the reconciliation step on resume.

**Alternatives considered:**
- Fail the interrupt handling if checkpoint cleanup fails: Too strict, leaves the user in a broken state
- Silently ignore checkpoint cleanup failures: Doesn't help with debugging

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| LangGraph JS checkpointer API may differ from Python | Test against actual LangGraph JS version, use public API only |
| Checkpoint reconciliation adds complexity to resume flow | Keep reconciliation simple: compare conversation arrays, write cleaned state if different |
| Thread ID management for checkpoint operations | Scope all checkpoint operations to current `thread_id`, verify thread ID is available |
| Performance impact of state comparison during reconciliation | Compare only message IDs and types, not full message content |
| Checkpointer may not be available in all contexts | Make checkpointer parameter optional, degrade gracefully if unavailable |

## Migration Plan

This is a bug fix with no migration required. The changes are internal to the cleanup and resume logic. No user-facing behavior changes except the fix itself (no more orphaned tool calls on resume).

## Open Questions

1. **LangGraph JS checkpointer API specifics**: Need to verify the exact API for updating checkpoint state in the Node.js variant. The Python docs reference `checkpointer.put()` and `checkpointer.update()`, but the JS API may differ.
2. **Thread ID availability**: Need to verify that `thread_id` is available in the interrupt handling context to scope checkpoint operations correctly.
3. **Checkpoint state format**: Need to understand the exact format of the state tuple that `checkpointer.put()` expects to ensure we're writing the correct structure.