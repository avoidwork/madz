## Why

When a user interrupts a tool execution, the TUI removes the assistant's AIMessage with tool_calls from the in-memory session state, but the LangGraph checkpoint retains the partial message. On resume, `streamEvents` replays from the checkpoint, sending orphaned tool references to the LLM API and corrupting the conversation. This causes duplicate tool calls, dangling tool references, and corrupted conversation history on resume.

## What Changes

- Extend `removeLastAssistantToolCallMessage()` in `stateManager.js` to accept an optional checkpointer and update the LangGraph checkpoint when provided
- Ensure both `handleChat()` and `handleCommand()` interrupt paths in `app.js` call the cleanup function with the checkpointer
- Add checkpoint reconciliation logic in `react.js` before `dispatchProvider` resumes after an interrupt
- Add integration test verifying checkpoint consistency after interrupt and resume

## Capabilities

### New Capabilities
<!-- None — this change modifies existing capabilities -->

### Modified Capabilities
- `interrupt-cleanup`: Extend requirements to include LangGraph checkpoint cleanup in addition to in-memory session state cleanup. The cleanup must propagate to the checkpoint to remove orphaned AIMessages with tool_calls.

## Impact

- `./src/session/stateManager.js` — `removeLastAssistantToolCallMessage()` gains checkpoint update capability
- `./src/tui/app.js` — `handleChat()` and `handleCommand()` interrupt handlers must pass checkpointer to cleanup
- `./src/agent/react.js` — `dispatchProvider` needs checkpoint reconciliation before resume
- `./tests/unit/` — New integration test for interrupt cleanup with checkpoint verification
- No API changes, no breaking changes, no new dependencies