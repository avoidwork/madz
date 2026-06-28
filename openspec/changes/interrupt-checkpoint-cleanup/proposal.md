## Why

Interrupt cleanup in the TUI only affects in-memory state, not the LangGraph checkpoint. When a user interrupts a tool call and resumes the conversation, orphaned AIMessages with incomplete tool_calls persist in the checkpoint. This causes duplicate tool calls, dangling tool references in LLM API requests, and corrupted conversation history on resume.

## What Changes

- Modify `removeLastAssistantToolCallMessage()` to update both in-memory state and the LangGraph checkpoint
- Add cleanup call to `handleCommand()` interrupt path to match `handleChat()` behavior
- Implement checkpoint reconciliation before resume to detect and fix state divergence
- Add integration test covering interrupt/resume scenario for both chat and command paths

## Capabilities

### New Capabilities
- `interrupt-cleanup`: Consistent cleanup of interrupted tool calls across in-memory state and LangGraph checkpoint, with reconciliation on resume

### Modified Capabilities
<!-- No existing spec-level behavior changes — this is a bug fix -->

## Impact

- `src/tui/app.js` — `handleChat()` and `handleCommand()` interrupt cleanup paths
- `src/session/stateManager.js` — `removeLastAssistantToolCallMessage()` checkpoint propagation
- `src/agent/react.js` — Resume reconciliation before `dispatchProvider`
- New integration test for interrupt/resume scenario