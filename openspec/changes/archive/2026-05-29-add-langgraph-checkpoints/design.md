## Context

The current `createReactAgent` in `src/agent/react.js` compiles a stateless ReAct agent at startup in `index.js:66`. The `dispatchProvider` closure (line 99) delegates to `callReactAgent` which sends `[SystemMessage?, HumanMessage(message)]` per call — no message history flows between invocations. The session `sessionId` (UUID from `src/session/factory.js:10`) is only used for file-based `.md` persistence in `memory/conversations/`.

LangGraph's `createReactAgent` prebuilt accepts a `checkpointer` option that, when compiled, enables thread-based conversation memory. A `thread_id` (from `configurable.thread_id`) associates all checkpoint writes with a conversation. Without it, the checkpointer auto-creates threads.

## Goals / Non-Goals

**Goals:**
- Add checkpointer integration to `createReactAgent` — optional parameter, backward compatible
- Pass `configurable.thread_id` from session's `sessionId` to agent invocations
- Support `InMemorySaver` for dev and `AsyncSqliteSaver` for persistent multi-turn conversations
- Create a `src/session/checkpointer.js` factory module that selects the checkpointer based on config
- Wire `thread_id` into both CLI and TUI call paths (`index.js` and `src/tui/app.js`)
- Add `persistence` config section to `config.yaml` and Zod schema in `src/config/schemas.js`

**Non-Goals:**
- Human-in-the-loop / interrupts (checkpoint resume from interrupts)
- Time-travel debugging (replaying from prior `checkpoint_id`)
- Persistent memory store across threads (LangGraph `Store` interface)
- Checkpoint encryption or delta channels
- Postgres checkpointer (deferred to a follow-up)

## Decisions

### Decision 1: Checkpointer is a separate factory module

`src/session/checkpointer.js` will export `createCheckpointer(config)` that returns a LangGraph checkpointer instance:

```javascript
// src/session/checkpointer.js
export function createCheckpointer(persistenceConfig = {}) {
  const mode = persistenceConfig.mode || "memory";
  switch (mode) {
    case "sqlite":
      return createSqliteCheckpointer(persistenceConfig.sqlitePath);
    case "memory":
    default:
      return createMemoryCheckpointer();
  }
}
```

Rationale: Keeps agent module focused on graph construction. Config-to-checkpointer mapping is isolated in one place. Makes testing easy — tests can swap the factory or mock it.

### Decision 2: Agent compilation per session, not per-call

Currently `index.js` creates the agent once at startup. We will change it so the agent is compiled with the checkpointer when the session is created. The `sessionId` will be passed as `configurable.thread_id` for each graph invocation.

```javascript
// Before (current):
const agent = createReactAgent(model, tools);

// After:
const checkpointer = createCheckpointer(config.persistence);
const agent = createReactAgent(model, tools, checkpointer);
```

Rationale: The checkpointer needs to be bound at compile time into the LangGraph graph. Creating the agent per-call is wasteful. The session owns the lifecycle — agent + checkpointer are created together. This also means we need the checkpointer before agent creation, which is why the factory must be async-compatible (SQLite setup may require async DB connections).

### Decision 3: thread_id flows through config, not through message content

The LangGraph convention is to pass `configurable: { thread_id: "..." }` as the second argument to `.invoke()` or `.streamEvents()`:

```javascript
agent.invoke({ messages: [...], configurable: { thread_id: sessionId } });
agent.streamEvents({ messages: [...] }, { version: "v3", configurable: { thread_id: sessionId } });
```

Rationale: This follows LangGraph's API convention. The `callReactAgent` helper needs to accept a third `config` parameter and pass it through. The streaming path also receives the config so `thread_id` is respected during stream events.

### Decision 4: Default to InMemorySaver for backward compatibility

The `persistence.mode` config defaults to `"memory"` which uses `InMemorySaver` from `langgraph-checkpoint`. This means existing users get in-memory conversation history within a single process run without any config changes. SQLite requires explicit opt-in via `persistence.mode: "sqlite"` and `persistence.sqlitePath`.

Rationale: No migration pain for existing users. The in-memory mode provides the multi-turn behavior during a single TUI session without requiring disk I/O. SQLite is available for users who want checkpoints to survive process restarts.

### Decision 5: Streaming path also receives thread_id

The current `callReactAgentStreaming` function in `src/agent/react.js:124` calls `agent.streamEvents({ messages: initMessages }, { version: "v3" })`. It needs to merge `configurable: { thread_id }` into the options object:

```javascript
const streamOptions = { version: "v3", ...(config?.configurable && { configurable: config.configurable }) };
const stream = await agent.streamEvents({ messages: initMessages }, streamOptions);
```

Rationale: Without passing `thread_id` in the streaming path, LangGraph would create a separate thread for streaming, breaking in-memory conversation continuity. Both `.invoke()` and `.streamEvents()` must use the same `thread_id`.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `langgraph-checkpoint` adds transitive deps (`msgpack`, `langchain-core`) | Already present as indirect deps via `@langchain/langgraph`; adding it explicitly does not increase the dependency tree |
| `InMemorySaver` leaks memory in long-running processes | Document as dev-only; recommend SQLite for production. In-memory state is garbage collected when the process exits. |
| SQLite checkpointer requires async DB setup at startup | `callReactAgent` prebuilt in recent `@langchain/langgraph` versions accepts sync checkpointers; the `AsyncSqliteSaver` from `langgraph-checkpoint-sqlite` is async but integrates via the graph's internal event loop |
| Rebuilding agent per session increases startup cost | Agent compilation is a one-time cost per session (~50-100ms); sessions are long-lived relative to this |
| Checkpoint state grows with conversation length | LangGraph stores full state snapshots per super-step. For multi-turn conversations this is bounded by the LLM's context window, which is already enforced separately via `session.context_window_size` |

## Migration Plan

1. Add `langgraph-checkpoint` (dev) and `langgraph-checkpoint-sqlite` (optional runtime) to `package.json`
2. Create `src/session/checkpointer.js` factory module with unit tests
3. Update `src/agent/react.js` — add optional `checkpointer` param to `createReactAgent` and `config` param to `callReactAgent`
4. Update `index.js` — create checkpointer, pass to agent, pass `thread_id` to `callProvider` / `dispatchProvider`
5. Update `src/tui/app.js` — pass thread_id when calling `dispatchProvider`
6. Update `config.yaml` and `src/config/schemas.js` with `persistence` section
7. Add specs for all three modified/new capabilities
8. Run pre-commit lint, format, and tests

## Open Questions

1. Should `callReactAgentStreaming` return the accumulated content before all stream events complete, or only after the full stream is consumed? (Current code returns after stream completes — no change needed here.)
2. Do we want to expose `getChatHistory(sessionId)` as a utility for the TUI to show past conversation messages from the checkpointer? (Out of scope for initial implementation — can be added later.)
3. Should the `configurable.thread_id` be generated per-message (a unique session per chat turn) or shared across the entire session? (Shared per session — `sessionId` serves as the thread_id.)
