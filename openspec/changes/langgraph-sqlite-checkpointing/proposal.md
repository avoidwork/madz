## Why

Currently, `madz` uses `createReactAgent` from `@langchain/langgraph/prebuilt` without a checkpointer. Conversation history lives only in an in-memory `SessionStateManager` and is written to flat JSON files on disk, which do not participate in LangGraph's checkpointing system. There is no support for resuming conversations after process restarts, fault-tolerant state recovery, time travel debugging, or human-in-the-loop interrupts.

## What Changes

- Replace the bare `createReactAgent` pattern with a `StateGraph` backed by `SqliteSaver` from `@langchain/langgraph-checkpoint-sqlite`.
- Add a `sqlite:` section to `config.yaml` for configuring the checkpoint database path.
- Introduce a `threadId` to session lifecycle — each session maps to a LangGraph `thread_id` for checkpoint routing.
- Add `listThreadIds()` utility to enumerate conversations from SQLite for the TUI conversation list.
- Make the existing JSON-file-based saver (`src/session/saver.js`) optional/legacy while SQLite becomes the primary persistence medium.
- No breaking API changes externally — `createReactAgent()` and `callReactAgent()` signatures remain identical.

## Capabilities

### New Capabilities

- `agent-checkpointing`: LangGraph StateGraph with SQLite-backed checkpoint persistence for conversation state, enabling resume, time travel, and fault tolerance.

### Modified Capabilities

<!-- None — session-management's requirements are preserved; persistence mechanism changes are an implementation detail. -->

## Impact

- **Dependencies**: New package `@langchain/langgraph-checkpoint-sqlite`.
- **Files added**: `src/agent/state_graph.js`, `src/session/saver.js` (replaced), `tests/unit/agent/state_graph.test.js`, `tests/unit/session/loader.test.js`.
- **Files modified**: `src/agent/react.js`, `src/session/factory.js`, `src/session/loader.js`, `config.yaml`, `src/config/schemas.js`, `package.json`, `index.js`.
- **Runtime**: SQLite database file created at `memory/checkpoints.db` (gitignored).
