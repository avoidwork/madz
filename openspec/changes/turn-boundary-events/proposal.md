## Why

deepagentsjs delegates all event handling to LangGraph's streaming protocol. While there are start/end pairs at the content-block level (message-start/message-finish), tool-call level (tool-started/tool-finished), and lifecycle level (started/completed/failed), there is no high-level "message send → response complete" event pair. This makes it impossible for consumers (UI, logging, middleware) to know when the agent has finished processing a user message and produced a complete response, especially when intermediate tool calls or subagent delegations are involved.

## What Changes

- Implement `createTurnTransformer()` — a `StreamTransformer` that emits `turn:start` when a new `HumanMessage` enters state and `turn:end` when the agent produces a complete `AIMessage` with content and no pending tool calls remain
- Export the transformer and `TurnEvent` type from the deepagents package
- Add type tests, unit tests, and integration tests
- Document call-site registration pattern via `streamTransformers`

## Capabilities

### New Capabilities
- `turn-boundary-events`: High-level turn boundary detection for deepagentsjs event system, providing `turn:start`/`turn:end` events that wrap an entire user-message-to-AI-response cycle

### Modified Capabilities
- *(none — no existing specs are modified)*

## Impact

- **New file**: `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/turn.ts` — turn boundary transformer implementation
- **New file**: `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/index.ts` — barrel export
- **Modified**: `tmp/deepagentsjs/libs/deepagents/src/index.ts` — re-export `createTurnTransformer` and `TurnEvent`
- **Modified**: `tmp/deepagentsjs/libs/deepagents/src/stream.test-d.ts` — add type tests
- **New file**: `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/turn.test.ts` — unit tests
- **New file**: `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/turn.int.test.ts` — integration test
- **No new dependencies** — all types from `@langchain/langgraph` (already a dependency)
