## Context

The TUI (Terminal User Interface) in `src/tui/app.js` manages conversation state through a `SessionStateManager` instance (`sessionState`). When a user sends a message, `dispatchProvider()` adds the user message to `sessionState.conversation`, streams the assistant's response, and appends the response to the conversation.

The interrupt flow works as follows:
1. User triggers interrupt → `handleInterrupt()` is called (line 944)
2. `handleInterrupt()` aborts the `AbortController` and waits for `dispatchPromise` to resolve
3. The `dispatchProvider()` try/catch catches the `AbortError` and calls `sessionState.popExchange()` (line 909)
4. `popExchange()` removes the last message from `sessionState.conversation` — this is the user's message
5. The assistant's partial response (an AIMessage with tool_calls) remains in the conversation array

On resume, the graph replays from the checkpoint. The checkpoint has the AIMessage with tool_calls but no ToolMessages (the tool was interrupted before completion). When the conversation is sent to the LLM API, the message sequence is corrupted — the system message is no longer at position 0, or there are orphaned tool_calls without ToolMessages. The LLM API rejects the request with a 400 error.

The `SessionStateManager` (`src/session/stateManager.js`) manages a `conversation` array of `{ role, content, timestamp }` objects. `addExchange()` pushes messages, `popExchange()` removes the last one.

## Goals / Non-Goals

**Goals:**
- When a tool is interrupted, remove the assistant's AIMessage with tool_calls from session state in addition to the user's message
- Ensure the conversation state is consistent before the next dispatch to the LLM API
- Prevent the "system message must be at the beginning" 400 error on resume
- Make the cleanup idempotent — safe to call even when no assistant tool-call message exists

**Non-Goals:**
- Changes to LangGraph's core interrupt mechanism or checkpoint system
- Changes to ToolNode's deduplication logic
- Changes to the streaming UI behavior
- Handling interrupts during non-tool-call responses (normal text responses already work correctly)

## Decisions

### Decision 1: Clean up in both handleInterrupt() and the AbortError catch block
**Choice:** Add cleanup logic in two places — `handleInterrupt()` (the interrupt entry point) and the AbortError catch block in `dispatchProvider()` (where `popExchange()` is currently called).

**Rationale:** The two code paths handle different timing scenarios:
- `handleInterrupt()` is called when the user explicitly triggers an interrupt during streaming
- The AbortError catch block handles the case where the abort propagates through the dispatch chain

Having cleanup in both places ensures consistency regardless of how the abort is triggered. The helper function is idempotent, so calling it from both paths is safe.

### Decision 2: Use a helper function to remove assistant tool-call messages
**Choice:** Create a helper function `removeLastAssistantToolCallMessage(sessionState)` that checks if the last conversation entry is an assistant message with tool_calls and removes it if so.

**Rationale:** 
- Encapsulates the cleanup logic in a single, testable function
- Makes the intent clear (removing assistant tool-call messages)
- Is idempotent — safe to call when no such message exists
- Can be reused in both `handleInterrupt()` and the AbortError catch block

### Decision 3: Check for tool_calls in the content field
**Choice:** The helper checks if the last message has `role === "assistant"` and if its `content` field contains tool call information (e.g., `tool_calls` array or a string representation of tool calls).

**Rationale:** The conversation array stores messages as `{ role, content, timestamp }`. The `content` field may contain either a string (for text responses) or an object with `tool_calls` (for tool-call responses). The helper needs to handle both cases.

### Decision 4: TUI-level fix, not LangGraph-level
**Choice:** Fix the issue at the TUI level by cleaning up session state, rather than modifying LangGraph's checkpoint or interrupt mechanisms.

**Rationale:** 
- LangGraph's interrupt mechanism is designed for intentional human-in-the-loop pauses, not abrupt TUI aborts
- Modifying LangGraph would require changes to dependencies and introduce more risk
- The TUI is the source of the abrupt abort, so it should handle the cleanup
- This is a smaller, more contained change with lower risk

## Risks / Trade-offs

### Risk: Conversation array structure changes
**Impact:** If the message structure in `sessionState.conversation` changes (e.g., messages are stored differently, or additional message types are added), the cleanup logic may need adjustment.
**Mitigation:** The helper function is defensive — it checks for specific conditions before removing messages. If the structure changes, the helper will simply be a no-op, which is safe.

### Risk: Cleanup interferes with normal flow
**Impact:** If the cleanup logic incorrectly removes messages during normal (non-interrupted) flow, it could corrupt the conversation.
**Mitigation:** The cleanup only runs in the AbortError catch block and in `handleInterrupt()`, both of which are only triggered during interruptions. The helper is also idempotent.

### Risk: Multiple tool calls in flight
**Impact:** If multiple tool calls are in flight when an interrupt occurs, the cleanup might only remove the last one, leaving others in an inconsistent state.
**Mitigation:** In practice, the TUI streams one response at a time, so only one assistant message with tool_calls should be in flight at any given time. If this changes in the future, the helper can be extended to remove all assistant messages with tool_calls.

### Risk: Timing edge case
**Impact:** If the interrupt happens between the assistant message being added to sessionState and the user message being added, the cleanup might remove the wrong message.
**Mitigation:** The cleanup removes the last message first (which should be the assistant's tool-call message), then the user message. The order is deterministic based on the message addition sequence.