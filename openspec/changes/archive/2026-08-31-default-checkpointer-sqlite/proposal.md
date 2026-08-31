## Why

The in-memory checkpointer loses all session data on process restart, making it unsuitable as a production default. SQLite provides durable, persistent storage that survives restarts, enables session recovery, and is the expected default for production use.

## What Changes

- Change the default persistence mode from `'memory'` to `'sqlite'` across all configuration layers (config.yaml, Zod schema, runtime fallback)
- Update the checkpointer spec requirement "Memory mode returns InMemorySaver" to reflect that the default mode is now `'sqlite'`
- Update the "Unknown mode defaults to memory" scenario to reflect that unknown modes still fall back to `InMemorySaver` (this behavior is unchanged)
- Update all tests that assume `'memory'` as the default checkpointer mode
- Update JSDoc documentation to reflect the new default

## Capabilities

### Modified Capabilities
- `checkpointer`: The default checkpointer mode changes from `'memory'` to `'sqlite'`. The requirement "Memory mode returns InMemorySaver" is renamed and updated to reflect that `'memory'` is no longer the default — calling with no argument now returns an `AsyncSqliteSaver` instance.

## Impact

- `config.yaml` — persistence mode default
- `src/config/schemas/persistence.js` — Zod schema default
- `src/session/checkpointer.js` — runtime fallback and JSDoc
- Test files covering checkpointer behavior
- OpenSpec spec: `openspec/specs/checkpointer/spec.md`

## Non-goals

- Migrating existing in-memory sessions to SQLite (sessions stored in memory are already lost on restart — that's the problem we're solving)
- Adding new checkpointer types (e.g., PostgreSQL, Redis)
- Changing the SQLite implementation or connection pooling
- Adding configuration migration tools
