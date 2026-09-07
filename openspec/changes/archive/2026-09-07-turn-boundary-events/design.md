## Context

deepagentsjs delegates all event handling to LangGraph's streaming protocol. The pipeline is:
ProtocolEvent → StreamMux → [transformers] → GraphRunStream projections.

LangGraph provides `StreamTransformer<TProjection>` interface with `init()`, `process()`, `onRegister()`, `finalize()`, `fail()`. Custom transformers can create `StreamChannel.local<T>()` for in-process streaming and `StreamChannel.remote<T>(name)` for remote-forwarded events. The `extensions` projection on `GraphRunStream` is the designated slot for user-supplied transformers.

The existing `createLifecycleTransformer` in `@langchain/langgraph/dist/stream/transformers/lifecycle.js` shows the stateful transformer pattern that this implementation will follow.

## Goals / Non-Goals

**Goals:**
- Implement `createTurnTransformer()` — a `StreamTransformer` that emits `turn:start`/`turn:end` events
- Watch the `values`/`updates` channel for a new `HumanMessage` entering state → emit `turn:start`
- Track active tool calls from the `tools` channel to know when the agent is "thinking"
- Detect terminal state: no pending tool calls + last message is an `AIMessage` with content → emit `turn:end`
- Surface events on `run.extensions.turns` as `AsyncIterable<{ type: "turn:start" | "turn:end", ... }>`
- Export the transformer and `TurnEvent` type from the deepagents package
- Add type tests, unit tests, and integration tests

**Non-Goals:**
- Remote forwarding of turn events (future concern)
- Built-in registration in `createDeepAgent()` (call-site opt-in only)
- Modifying existing LangGraph transformers or stream internals
- Supporting non-LangGraph event systems (EventEmitter, etc.)

## Decisions

1. **Call-site registration over built-in**: The transformer is registered via `streamTransformers` param in `createDeepAgent()` or at call-site via `streamEvents(..., { transformers: [...] })`. This keeps the core agent lean and lets consumers opt in.

2. **Local StreamChannel over remote**: Turn events use `StreamChannel.local<TurnEvent>()` so they are in-process only. Remote forwarding can be added later via `StreamChannel.remote()` if needed.

3. **Namespace-aware processing**: The transformer tracks the root namespace and handles nested subagent namespaces correctly, so turn events from subagents don't interfere with root-level turn detection.

4. **Stateful tracking**: The transformer maintains internal state (pending tool call count, last seen messages) across `process()` calls to correctly detect turn boundaries.

## Risks / Trade-offs

- [Risk] Re-entrant self-processing: The transformer's `onRegister()` receives a `StreamEmitter.push()` that routes through all transformers including itself. Mitigation: The transformer guards against re-entrant processing by checking a flag.
- [Risk] Race condition on tool call tracking: If tool-started and tool-finished events arrive out of order, the pending count could go negative. Mitigation: Use a `Map<string, boolean>` keyed by tool call ID rather than a simple counter.
- [Risk] Subagent tool calls: Tool calls from subagents appear on different namespaces. Mitigation: Track tool calls across all namespaces, not just the root.
