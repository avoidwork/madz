## Why

ToolMessage instances are incorrectly converted to AIMessage instances during conversation compaction in the ReAct agent. When the conversation exceeds context length and `compactConversation` is called, the message rebuild logic in both `callReactAgent` and `callReactAgentStreaming` only handles "system" and "user" roles explicitly — all other roles (including "tool") fall through to `new AIMessage(m.content)`. This causes tool results to be permanently lost, breaking the agent's ability to continue a conversation that depends on prior tool outputs.

## What Changes

- Add a `case` for `m.role === "tool"` in the message rebuild logic at lines 190-197 in `callReactAgent` (`src/agent/react.js`)
- Add a `case` for `m.role === "tool"` in the message rebuild logic at lines 494-501 in `callReactAgentStreaming` (`src/agent/react.js`)
- ToolMessage instances will be reconstructed using `new ToolMessage(m.content)` when the role is "tool"

## Capabilities

### New Capabilities
<!-- None — this is a bug fix to existing behavior -->

### Modified Capabilities
<!-- None — no spec-level requirement changes, only implementation fix -->

## Impact

- `src/agent/react.js` — two message rebuild sections (callReactAgent and callReactAgentStreaming)
- `@langchain/core/messages` — ToolMessage already imported, no new dependencies
- No API changes, no breaking changes
- Compacted conversations will now correctly preserve tool results across compaction cycles