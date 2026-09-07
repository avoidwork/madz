CHANGE_NAME: turn-boundary-events

## Summary

Add turn:start/turn:end boundary events to the deepagentsjs event system by implementing a custom StreamTransformer that wraps an entire user-message-to-AI-response cycle, including all intermediate tool calls and subagent delegations.

## Technical Approach

deepagentsjs delegates all event handling to LangGraph's streaming protocol (ProtocolEvent → StreamMux → transformers → GraphRunStream projections). While there are start/end pairs at the content-block level (message-start/message-finish), tool-call level (tool-started/tool-finished), and lifecycle level (started/completed/failed), there is no high-level "message send → response complete" event pair. This makes it impossible for consumers (UI, logging, middleware) to know when the agent has finished processing a user message and produced a complete response, especially when intermediate tool calls or subagent delegations are involved.

The solution is a `createTurnTransformer()` factory function implementing `StreamTransformer<{ turns: AsyncIterable<TurnEvent> }>`. In `init()`, it creates a `StreamChannel.local<TurnEvent>()` for the turn event log. In `process()`, it watches the `"values"`/`"updates"` channel for a new `HumanMessage` entering state → emits `{ type: "turn:start" }`. It tracks active tool calls from the `"tools"` channel (tool-started → increment counter, tool-finished → decrement). It detects terminal state — no pending tool calls + last message is an `AIMessage` with content → emits `{ type: "turn:end" }`.

The transformer is registered via `streamTransformers` in `createDeepAgent()` or at call-site via `streamEvents(..., { transformers: [...] })`. Events surface on `run.extensions.turns` as `AsyncIterable<{ type: "turn:start" | "turn:end", ... }>`.

## Files to Create/Modify

1. **CREATE** `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/turn.ts` — the turn boundary transformer implementation
2. **CREATE** `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/index.ts` — barrel export
3. **MODIFY** `tmp/deepagentsjs/libs/deepagents/src/index.ts` — re-export `createTurnTransformer` and `TurnEvent`
4. **MODIFY** `tmp/deepagentsjs/libs/deepagents/src/stream.test-d.ts` — add type tests
5. **CREATE** `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/turn.test.ts` — unit tests
6. **CREATE** `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/turn.int.test.ts` — integration test

## Architecture Decisions

- **No new dependencies** — all types from `@langchain/langgraph` (already a dependency)
- **Call-site registration** rather than built-in — consumers opt in via `streamTransformers`
- **Local StreamChannel** (not remote) — turn events are in-process only; remote forwarding can be added later
- **Namespace-aware** — the transformer should handle nested subagent namespaces correctly
