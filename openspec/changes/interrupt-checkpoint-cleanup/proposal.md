## Why

When a user interrupts a tool call during a conversation, the cleanup only removes messages from in-memory state but leaves orphaned AIMessages with tool_calls in the LangGraph checkpoint. On resume, the checkpoint replays these orphaned messages, causing duplicate tool calls, dangling tool references in LLM API requests, and corrupted conversation history. This breaks the user experience and can cause confusing or broken conversation flows.

## What Changes

- Extend `removeLastAssistantToolCallMessage()` in `stateManager.js` to accept an optional checkpointer and propagate cleanup to the LangGraph checkpoint
- Add missing `removeLastAssistantToolCallMessage()` call to `handleCommand()` interrupt path in `app.js` to match `handleChat()` behavior
- Implement checkpoint reconciliation before `dispatchProvider` after an interrupt to ensure checkpoint and in-memory state are consistent
- Add integration test verifying checkpoint contains no orphaned tool calls after interrupt + resume

## Capabilities

### New Capabilities
- `interrupt-cleanup`: Propagate session state cleanup to LangGraph checkpoint on interrupt, ensuring no orphaned tool calls persist across resume

### Modified Capabilities
<!-- No existing capabilities have spec-level requirement changes -->

## Impact

- **Affected code**: `./src/tui/app.js` (handleChat, handleCommand), `./src/session/stateManager.js` (removeLastAssistantToolCallMessage), `./src/agent/react.js` (dispatchProvider, graph setup)
- **Dependencies**: LangGraph checkpointer API (JS/Node.js variant)
- **Breaking changes**: None — this is a bug fix that changes internal cleanup behavior without altering public APIs
- **Systems**: LangGraph checkpoint store, conversation state management