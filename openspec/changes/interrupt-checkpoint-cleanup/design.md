## Context

The madz application uses LangGraph for state machine management with a checkpointer that persists conversation state per thread. When a user interrupts a tool execution (via command or cancel), the TUI cleans up in-memory state by removing the assistant's AIMessage with tool_calls from the session state conversation array. However, the LangGraph checkpoint retains the partial message, causing orphaned tool calls to persist and corrupt subsequent turns.

The current cleanup flow:
1. `handleChat()` (app.js:922-924) calls `removeLastAssistantToolCallMessage()` and `popExchange()`
2. `handleCommand()` (app.js:524-526) only calls `popExchange()` — missing tool call cleanup
3. `removeLastAssistantToolCallMessage()` (stateManager.js:80-88) only modifies `sessionState.#state.conversation`
4. The LangGraph checkpoint (written at superstep boundaries by `createReactAgentGraph`) retains the partial AIMessage
5. On resume, `streamEvents` replays from the checkpoint, sending dangling tool references to the LLM API

## Goals / Non-Goals

**Goals:**
- Extend `removeLastAssistantToolCallMessage()` to accept an optional checkpointer and update the checkpoint when provided
- Ensure both `handleChat()` and `handleCommand()` interrupt paths perform checkpoint cleanup
- Add checkpoint reconciliation before `dispatchProvider` resumes after an interrupt
- Add integration test verifying checkpoint consistency after interrupt and resume

**Non-Goals:**
- Changing the checkpointer factory or checkpointer implementation
- Modifying the `isNewThread` flag behavior (it continues to control only system prompt injection)
- Adding new dependencies or changing the checkpointer persistence mode
- Refactoring the entire interrupt handling pipeline

## Decisions

1. **Checkpoint cleanup via checkpointer parameter**: Pass the checkpointer as an optional parameter to `removeLastAssistantToolCallMessage()` rather than importing it directly in stateManager.js. This maintains separation of concerns and keeps stateManager focused on state management.

2. **Checkpoint state replacement over incremental update**: When cleaning up after interrupt, read the current checkpoint state, remove the orphaned message, and write the cleaned state back via `checkpointer.put()`. This is simpler than trying to identify and remove specific messages from the checkpoint chain.

3. **Reconciliation before dispatch, not after**: Checkpoint reconciliation happens before `dispatchProvider` resumes, not after cleanup. This ensures the checkpoint is consistent before any new LLM calls are made.

4. **Idempotent cleanup**: The cleanup function must be safe to call multiple times. If the checkpoint has already been cleaned, calling it again should be a no-op.

## Risks / Trade-offs

1. **Risk**: Checkpointer API may differ between InMemorySaver and AsyncSqliteSaver
   **Mitigation**: Use the common LangGraph checkpointer interface; test with both modes

2. **Risk**: Checkpoint state read/write may have race conditions during streaming
   **Mitigation**: Cleanup only happens after the stream is fully aborted; the abort signal ensures no concurrent writes

3. **Risk**: Reconciliation may be complex if checkpoint and in-memory state diverge significantly
   **Mitigation**: Start with simple approach — if in-memory conversation is shorter than checkpoint, truncate checkpoint to match; if longer, write in-memory to checkpoint

4. **Trade-off**: Adding checkpoint operations adds slight latency to interrupt handling
   **Mitigation**: Interrupt handling is already a relatively rare path; the latency is negligible compared to the benefit of preventing corrupted conversations

## Open Questions

1. Does the JS LangGraph checkpointer API expose a direct way to update checkpoint state, or do we need to reconstruct the entire state chain?
2. How do we identify the "last assistant message with tool_calls" in the checkpoint state — is it the same logic as in-memory?
3. Should we add a new checkpointer method specifically for cleanup, or use the existing `put()` interface?