## Context

The TUI uses LangGraph for conversation state management. When a user interrupts a tool call (via command or cancel), the cleanup only removes messages from the in-memory conversation array. The LangGraph checkpoint — which persists state at superstep boundaries — retains the partial AIMessage with tool_calls. On resume, `streamEvents` replays from the checkpoint, sending orphaned tool references to the LLM API.

Current cleanup paths:
- `handleChat()` (app.js:922-924): calls `removeLastAssistantToolCallMessage()` + `popExchange()`
- `handleCommand()` (app.js:524-526): only calls `popExchange()` — missing tool call cleanup

The `removeLastAssistantToolCallMessage()` function (stateManager.js:80-88) only modifies `sessionState.#state.conversation`.

## Goals / Non-Goals

**Goals:**
- Ensure interrupt cleanup propagates to the LangGraph checkpoint
- Add missing cleanup to `handleCommand()` interrupt path
- Implement checkpoint reconciliation on resume as a safety net
- Add integration test covering interrupt/resume scenario

**Non-Goals:**
- Refactoring the overall interrupt handling architecture
- Changing the `isNewThread` flag behavior
- Modifying the LangGraph checkpoint schema or persistence layer
- Handling interrupts during system prompt generation

## Decisions

1. **Checkpoint update via checkpointer.put()**
   - Use `checkpointer.put()` with the cleaned conversation state rather than trying to delete individual messages
   - Rationale: LangGraph's JavaScript implementation doesn't expose a `delete` API; `put()` with cleaned state is the canonical way to update checkpoint state
   - Alternatives considered: `checkpointer.update()` (less explicit), manual message filtering (fragile)

2. **Pass checkpointer to stateManager**
   - The checkpointer instance needs to be accessible from `stateManager.js` to update the checkpoint
   - Pass it through the session state constructor or as a parameter to `removeLastAssistantToolCallMessage()`
   - Rationale: Keeps stateManager focused on state operations while giving it checkpoint access
   - Alternatives considered: Global singleton (harder to test), callback pattern (more complex)

3. **Reconciliation only after interrupt**
   - Checkpoint reconciliation runs only when an interrupt occurred, not on every resume
   - Rationale: Adds minimal overhead to normal resume path; interrupt is the only scenario where divergence is expected
   - Implementation: Track interrupt state in session, check before `dispatchProvider` in react.js

4. **Compare conversation arrays for divergence**
   - Reconciliation compares the in-memory conversation array with the checkpoint's stored messages
   - If lengths differ or last messages don't match, write cleaned state to checkpoint
   - Rationale: Simple comparison is sufficient for this bug; complex diffing is unnecessary

## Risks / Trade-offs

1. **[Risk] Checkpointer API differences between Python and JS** → [Mitigation] Verify the JavaScript LangGraph checkpointer API; use `put()` with full state if `update()` is unavailable
2. **[Risk] Race condition if interrupt and resume happen rapidly** → [Mitigation] Reconciliation on resume catches any divergence; interrupt flag prevents concurrent cleanup
3. **[Risk] Performance impact of checkpoint write on interrupt** → [Mitigation] Checkpoint writes are infrequent (only on interrupt); negligible compared to LLM API calls
4. **[Risk] Test complexity for interrupt simulation** → [Mitigation] Use mocked checkpointer and simulate interrupt via controlled state changes rather than real async timing

## Migration Plan

This is a bug fix with no migration required. The changes are:
1. Modify `removeLastAssistantToolCallMessage()` to accept optional checkpointer parameter
2. Update `handleCommand()` to call cleanup before `popExchange()`
3. Add reconciliation check in `react.js` before `dispatchProvider`
4. Add integration test

No rollback strategy needed — the fix is additive and defensive. If issues arise, revert the feature branch.

## Open Questions

1. Does the JavaScript LangGraph checkpointer expose the same `put()`/`update()` API as Python?
2. What is the exact structure of the checkpoint state that needs to be updated?
3. Should reconciliation also verify tool result messages, or only assistant messages with tool_calls?