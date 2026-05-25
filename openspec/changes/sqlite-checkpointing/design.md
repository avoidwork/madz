## Context

The ReAct agent is created in `src/agent/react.js` without any checkpointer, meaning every invocation is stateless from LangGraph's perspective. The existing `src/session/stateManager.js` provides in-memory conversation tracking that persists to files on shutdown, but this is separate from LangGraph's internal state — it does not persist tool call graphs, intermediate reasoning, or checkpointed node execution state.

## Goals / Non-Goals

**Goals:**
- Add SQLite-backed checkpointer as a drop-in replacement for the default (no persistence)
- Wire checkpointer into agent creation based on config
- Pass `thread_id` from session to LangGraph invocations so each session gets its own state tree
- Support enabling/disabling SQLite checkpointing via config
- Keep `MemorySaver` path available for tests

**Non-Goals:**
- Postgres or MongoDB checkpointer support (deferred to multi-tenant migration)
- Checkpoint migration from in-memory state to SQLite
- Background compaction of old checkpoints
- Distributed checkpoint locking (single-tenant only)

## Decisions

### D1: Use `@langchain/langgraph-checkpoint-sqlite` (SQLiteSaver)
- **Choice**: `SQLiteSaver` via `@langchain/langgraph-checkpoint-sqlite`
- **Rationale**: Recommended LangGraph checkpointer for single-tenant/dev use. Drop-in compatibility. Uses `better-sqlite3` which provides synchronous-safe SQLite with good Node.js integration.
- **Alternative considered**: `MemorySaver` only — inadequate because it provides no persistence across process restarts.
- **Alternative considered**: Postgres checkpointer — overkill for single-tenant; adds DB infrastructure requirement.

### D2: Factory pattern for checkpointer creation
- **Choice**: `src/agent/checkpointer.js` with a `createCheckpointer(config)` factory function
- **Rationale**: Separates checkpointer instantiation from agent factory; makes tests easy to mock; allows enabling/disabling based on config.
- **Returns**: `{ SaverConstructor, checkpointerConfig }` — the constructor (or `null`) and the config object to pass to the graph.

### D3: thread_id = session ID mapping
- **Choice**: The session ID from `src/session/stateManager.js` is passed as `configurable: { thread_id }` on every agent invocation.
- **Rationale**: One session → one thread, simple 1:1 mapping. No migration needed since sessions already have UUIDs.

### D4: Config schema placement
- **Choice**: New `agent.checkpoints` section in `config.yaml` and `src/config/schemas.js`
- **Schema shape**: `{ enabled: bool, dbPath: string }`
- **Defaults**: `enabled: true`, `dbPath: "memory/checkpoints/db.sqlite"`

### D5: Graceful degradation
- **Choice**: If `agent.checkpoints.enabled` is `false` (or missing), the agent is created without a checkpointer — no breakage to existing behavior.
- **Rationale**: Zero-risk rollout. If SQLite native bindings fail to load, the system can fall back to no persistence.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| `better-sqlite3` native binding may fail on some platforms (ARM, minimal Docker) | Graceful fallback: log warning, set `enabled: false`, continue without checkpointing; document requirements in README. |
| SQLite file lock contention from concurrent sessions | Single-tenant design means one session at a time; no contention expected. |
| Checkpoint database grows unbounded over time | Future: checkpoint compaction TTL. Not needed for dev/alpha. |
| `thread_id` collision if sessions are reused with same ID | Sessions already use UUIDs; UUIDs are globally unique. No collision risk. |
| `index.js` becomes more complex with checkpointer wiring | Extract checkpointer wiring into `src/agent/checkpointer.js`; `index.js` remains simple. |
