## Context

`madz` is a Node.js-based AI harness application using LangGraph for state machines and a Terminal UI (Ink) for interaction. The current agent is a prebuilt `createReactAgent` without persistence beyond in-memory state and flat JSON files. Users want conversation continuity across process restarts and fault tolerance during graph execution.

LangGraph's checkpointing system requires:
1. A `StateGraph` (not prebuilt agent) compiled with a checkpointer.
2. A checkpointer conforming to `BaseCheckpointSaver`.
3. A `thread_id` in the config for each invocation.

The project uses ESM (`"type": "module"`), Node 20+, `@langchain/langgraph` v1.3.2, and the `Annotation` API for state schemas.

## Goals / Non-Goals

**Goals:**
- Replace `createReactAgent` with a `StateGraph` wired with `SqliteSaver`.
- Persist graph state at every super-step boundary to a SQLite database.
- Provide `listThreadIds()` so the TUI can enumerate saved conversations.
- Maintain backward-compatible function signatures (`createReactAgent`, `callReactAgent`).
- Preserve 100% test coverage via unit tests for the new module.

**Non-Goals:**
- Migrate to PostgreSQL or production-grade persistent stores (future work).
- Add semantic memory store (`Store` interface) — separate change.
- Implement human-in-the-loop interrupts — relies on checkpointing but out of scope.
- Rewrite the TUI or conversation panel — those use the same API.

## Decisions

### Decision 1: Use `@langchain/langgraph-checkpoint-sqlite` instead of raw `better-sqlite3`

LangGraph provides an official `SqliteSaver` implementation that handles table creation, serialization (via `SerializerProtocol`), and the `BaseCheckpointSaver` interface contract. Using this avoids reinventing checkpoint serialization, blob hashing, and write ordering.

**Alternative considered**: Wrapping `better-sqlite3` manually. Rejected because it requires implementing all `BaseCheckpointSaver` methods and serializing LangGraph state blobs correctly.

### Decision 2: Use `Annotation.Root()` state schema rather than rewriting graph nodes

The prebuilt `createReactAgent` uses an implicit `messages` channel. The minimal migration is to define a `State` with a single `messages` channel using a `reducer` that accumulates messages (preserving full history). This lets us keep the existing ReAct node logic unchanged.

```javascript
const State = Annotation.Root({
  messages: Annotation({
    reducer: (current, update) => [...current, update],
    default: () => [],
  }),
});
```

**Alternative considered**: Rewiring graph nodes manually. Rejected because it increases risk and doesn't add value — the prebuilt nodes work with `StateGraph` out of the box.

### Decision 3: Cache compiled graph by `${dbPath}:${model.modelName}`

The graph is compiled once at startup and cached in a `Map`. This avoids re-initializing the checkpointer and re-wiring edges on every agent call.

**Risk**: Multiple model instances with the same model name but different configs would share a graph. Mitigation: in current usage, only one provider is active per session startup.

### Decision 4: Default SQLite path to `memory/checkpoints.db` (within `config.yaml`)

The path is configurable, defaulting to a gitignored location. This keeps it alongside other session memory data.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `SqliteSaver` creates tables on first `put()` — `listThreadIds()` on empty DB returns empty set | Handle gracefully; it's expected behavior for first-run sessions |
| Single-writer concurrency per `thread_id` | WAL mode handles this; concurrent writes to different `thread_id` values serialize safely via journal |
| SQLite file grows unbounded over time | Future: add a retention/cleanup task that prunes old checkpoints (out of scope) |
| State schema mismatch between old `createReactAgent` and new `StateGraph` | Use `Annotation.Root({ messages, ... })` matching the prebuilt shape; tests verify message structure |

## Migration Plan

1. Add `@langchain/langgraph-checkpoint-sqlite` dependency.
2. Add `sqlite:` config section with default path.
3. Wire `buildCheckpointedGraph()` to replace `createReactAgent` internally.
4. Add `threadId` to session factory; pass it as `configurable.thread_id`.
5. Run existing tests to verify no regressions.
6. Add new tests for `state_graph.js` and session loader.

**Rollback**: The `sqlite:` config section is optional. If absent or the checkpointer throws, fall back to the non-persistent `createReactAgent` path. JSON conversation files remain as human-readable fallback.

## Open Questions

1. **Checkpoint retention**: Should we add a TTL or max-checkpoint limit? The `SqliteSaver.list()` method supports `before`, `limit`, `offset` filters — useful for a future retention task.
2. **Multi-provider support**: If `madz` adds more LLM providers concurrently, each would get its own graph cache entry. Is that acceptable? Yes — each provider has different model config and tools.
3. **Thread migration**: Should we migrate existing JSON conversation files into SQLite checkpoints? Out of scope — these are new threads going forward.
