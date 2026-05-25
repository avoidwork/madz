## Why

The ReAct agent currently has no persistent state between invocations. Each call starts with a clean slate — no tool call history, no reasoning chain, and no ability to resume interrupted sessions. LangGraph's checkpointer system provides thread-aware state persistence, enabling conversation continuity across calls. SQLite is the recommended lightweight checkpointer for single-tenant / dev use, using `better-sqlite3` under the hood.

## What Changes

- Add `@langchain/langgraph-checkpoint-sqlite` and `better-sqlite3` as dependencies
- Create a `checkpointer` factory module (`src/agent/checkpointer.js`) that produces a configured `SQLiteSaver`
- Modify `createReactAgent` to accept an optional `checkpointer` and pass it to `createReactAgentGraph`
- Modify `callReactAgent` (both sync and streaming paths) to include a `thread_id` in the LangGraph `config` object
- Add checkpointer configuration to `config.yaml` schema (enable/disable, database path)
- Wire the checkpointer into `index.js` based on config
- Add unit tests for the checkpointer module and updated agent functions

## Capabilities

### New Capabilities

- `sqlite-checkpointing`: LangGraph thread-aware checkpointer using SQLite for persistent session state, enabling conversation resumption and stateful multi-turn interactions

### Modified Capabilities

- `session-management`: Extended with requirement for LangGraph-level checkpointing beyond the existing file-based conversation history. The session now carries a `thread_id` that maps to the checkpointer's state key.

## Impact

| Area | Impact |
|------|--------|
| `src/agent/react.js` | `createReactAgent` signature changes (optional `checkpointer` param); `callReactAgent` and `callReactAgentStreaming` pass `configurable: { thread_id }` |
| `src/agent/checkpointer.js` | **New** — factory for `SQLiteSaver` |
| `index.js` | Checkpointer instantiated at startup, wired into agent |
| `src/config/schemas.js` | New `agent.checkpoints` config schema sections |
| `config.yaml` | New `agent.checkpoints:` section |
| `package.json` | New deps: `@langchain/langgraph-checkpoint-sqlite`, `better-sqlite3` |
| `tests/unit/agent/` | New test file for checkpointer; updated tests for react agent |
