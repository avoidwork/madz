## Context

The madz project uses LangGraph checkpointer for session state persistence. Currently, the default checkpointer mode is `'memory'` (InMemorySaver), which stores all checkpoint data in RAM. This means all session data is lost on process restart. The project already supports `'sqlite'` mode via `@langchain/langgraph-checkpoint-sqlite`, but it requires explicit configuration.

## Goals / Non-Goals

**Goals:**
- Shift the default checkpointer mode from `'memory'` to `'sqlite'` across all configuration layers
- Ensure backward compatibility — explicit `'memory'` mode still works
- Update tests and documentation to reflect the new default

**Non-Goals:**
- Migrating existing in-memory sessions to SQLite
- Adding new checkpointer backends
- Changing SQLite connection pooling or performance tuning

## Decisions

### Decision 1: Default at three layers
The default must be changed at three independent layers to prevent fallback to `'memory'`:
1. **config.yaml** — The authoritative config file default (read at startup)
2. **Zod schema** (`src/config/schemas/persistence.js`) — Validation fallback when config omits the field
3. **Runtime fallback** (`src/session/checkpointer.js`) — Fallback when no config is passed at all

All three must be consistent; otherwise, edge cases (e.g., no config passed) will silently revert to `'memory'`.

### Decision 2: No migration path
Existing sessions stored in memory are already lost on restart — that's the problem we're solving. No migration from memory to SQLite is needed or expected.

### Decision 3: SQLite path defaults to `memory/checkpoints.db`
The existing `sqlite_path` default (`'memory/checkpoints.db'`) is already appropriate and does not need to change. The `memory/` directory is the project's data directory (not in-memory).

## Risks / Trade-offs

[Risk] Users who relied on in-memory behavior (transient sessions) will now get persistence by default.
→ Mitigation: Users can explicitly set `mode: memory` in their config to retain the old behavior.

[Risk] Tests that assume `'memory'` as the default will fail.
→ Mitigation: All tests are updated to either explicitly pass `{ mode: 'memory' }` when needed, or expect `'sqlite'` as the default.

[Risk] SQLite file creation on first run.
→ Mitigation: `@langchain/langgraph-checkpoint-sqlite` creates the file automatically; the `memory/` directory already exists.
