## Why

The current `createReactAgent` in `src/agent/react.js` compiles the ReAct agent without a LangGraph checkpointer, making it completely stateless across invocations. Each call to `callReactAgent` sends only `[SystemMessage?, HumanMessage(message)]` — no message history accumulates. The session `sessionId` exists only for file-based `.md` persistence in `memory/conversations/` and is never passed to the LangGraph graph. This means conversations are inherently single-turn: the agent has no memory of previous exchanges within a session.

Adding checkpointer-based persistence enables true multi-turn conversations where the agent retains message history across invocations, and the graph can resume from the last state.

## What Changes

- Add `langgraph-checkpoint` as a dev dependency and `langgraph-checkpoint-sqlite` as an optional runtime dependency
- Create `src/session/checkpointer.js` — a thin checkpointer factory module that creates the checkpointer instance based on config (InMemorySaver for dev, AsyncSqliteSaver for persistent storage)
- Modify `src/agent/react.js`:
  - `createReactAgent(model, tools, checkpointer)` gains an optional third `checkpointer` parameter
  - Pass checkpointer to `createReactAgentGraph({ llm: model, tools, checkpointer })`
  - `callReactAgent(agent, message, config, systemPrompt, callback)` gains an optional `config` parameter accepting `{ configurable: { thread_id: string } }`
  - Invoke agent with `{ messages: [...], ...config }` to resume conversation threads
- Modify `src/session/factory.js`:
  - Use `sessionId` as the LangGraph `thread_id` when passing config to the agent
- Modify `index.js`:
  - Pass `threadId: session.sessionId` to agent invocations via the agent config
- Modify `src/tui/app.js`:
  - Pass the session's thread_id with every `dispatchProvider` call for streaming
- Add `persistence` section to `src/config/schemas.js` Zod schema with `mode` (enum: memory/sqlite/postgres, default: "memory") and `sqlite_path` (string, default: "memory/checkpoints.db")
- Update `config.yaml` with the new `persistence` section
- Add unit tests: `tests/unit/checkpointer.test.js` and `tests/unit/react_agent_checkpoint.test.js`

## Capabilities

### New Capabilities

- `checkpointer`: LangGraph checkpointer integration that persists graph state between invocations. Supports `InMemorySaver` for dev/experimentation and `AsyncSqliteSaver` for persistent multi-turn conversations. The checkpointer is optional — if not provided, the agent behaves as before (stateless).

### Modified Capabilities

- `react-agent`: `createReactAgent(model, tools, checkpointer)` now accepts an optional third parameter for a LangGraph checkpointer. `callReactAgent(agent, message, config, ...)` now accepts an optional `config` parameter with `configurable.thread_id` for thread-based conversation persistence.
- `session-management`: The session's `sessionId` MUST be passed as `configurable.thread_id` to LangGraph agent invocations, enabling the checkpointer to associate all checkpoints with the correct conversation thread.
- `config-system`: Adds a new `persistence` config section at the top level with `mode` (string, enum: memory/sqlite/postgres, default: "memory") and optional `sqlite_path` (string, default: "memory/checkpoints.db") for configuring the checkpointer backend.

## Impact

- **Dependencies**: Adds `langgraph-checkpoint` (dev dependency, provides `InMemorySaver`). Adds `langgraph-checkpoint-sqlite` as an optional runtime dependency for SQLite-backed persistence.
- **Files created**: `src/session/checkpointer.js`, `tests/unit/checkpointer.test.js`, `tests/unit/react_agent_checkpoint.test.js`
- **Files modified**: `src/agent/react.js`, `src/session/factory.js`, `index.js`, `src/tui/app.js`, `src/config/schemas.js`, `config.yaml`, `package.json`
- **Breaking changes**: None. The `checkpointer` parameter is optional — when omitted the agent behaves identically to the current stateless version. The `thread_id` is optional — without it the checkpointer creates a new thread automatically.
