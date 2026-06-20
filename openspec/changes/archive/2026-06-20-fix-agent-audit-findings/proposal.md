## Why

A code audit of `src/agent/react.js` identified three issues: a high-severity bug where `callReactAgentStreaming` returns the original user message instead of the aggregated AI response text, a medium-severity bug where message type detection only handles three message types (missing ToolMessage and chunk variants), and a low-severity performance issue with unnecessary array copies during message iteration. These bugs cause the agent to return incorrect content in streaming mode and fail to handle tool messages correctly.

## What Changes

- Fix `callReactAgentStreaming` to return `{ content: aggregatedText || originalMessage }` instead of `{ content: originalMessage }` on both return paths (success and end-of-stream)
- Extract message type detection into a `getMessageRole()` helper that handles HumanMessage, AIMessage, SystemMessage, ToolMessage, and their chunk variants (HumanMessageChunk, AIMessageChunk), falling back to "system" for unknown types
- Replace both inline type detection call sites in `callReactAgent` and `callReactAgentStreaming` with calls to `getMessageRole()`
- Replace `[...msgsArray].reverse().find()` with a reverse for-loop in `extractContent()` to eliminate unnecessary array allocations

## Capabilities

### New Capabilities
<!-- None — this is a bug fix, not a new capability -->

### Modified Capabilities
- `agent`: Streaming response now correctly returns aggregated AI text instead of the original user query; message type detection now handles ToolMessage and chunk variants

## Impact

- **Affected code:** `src/agent/react.js` (primary), `tests/unit/react_agent.test.js` (new tests)
- **API changes:** None — public API (`callReactAgent`, `callReactAgentStreaming`, `createReactAgent`, `clearCache`) unchanged
- **Behavior changes:** Streaming responses now return actual AI text (correct behavior); ToolMessage instances are now correctly mapped to "tool" role in conversation history
- **Dependencies:** No new dependencies — ToolMessage and HumanMessageChunk are already available in `@langchain/core/messages`