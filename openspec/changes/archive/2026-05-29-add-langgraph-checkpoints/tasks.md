## 1. Dependencies

- [x] 1.1 Add `langgraph-checkpoint` to `package.json` as a dev dependency (provides `InMemorySaver` for experimentation and testing)
- [x] 1.2 Add `langgraph-checkpoint-sqlite` to `package.json` as an optional runtime dependency (provides `AsyncSqliteSaver` for persistent checkpoints)
- [x] 1.3 Run `npm install` to install the new dependencies

## 2. Config schema

- [x] 2.1 Create `PersistenceSchema` in `src/config/schemas.js` with `mode` (enum: "memory" | "sqlite", default: "memory") and `sqlite_path` (string, default: "memory/checkpoints.db")
- [x] 2.2 Add `persistence` key to `ConfigSchema` using `PersistenceSchema`
- [x] 2.3 Add `persistence` entry to `DEFAULT_CONFIG` exporting default values
- [x] 2.4 Update `config.yaml` to include `persistence:` section with `mode: memory`
- [x] 2.5 Create `tests/unit/config_persistence.test.js` with tests for the schema validation (memory mode default, sqlite mode, invalid mode fallback)

## 3. Checkpointer factory module

- [x] 3.1 Create `src/session/checkpointer.js` with JSDoc comments on all public functions
- [x] 3.2 Implement `createCheckpointer(persistenceConfig)` that switches on `mode`:
  - `"memory"` → imports and returns `InMemorySaver` from `langgraph-checkpoint`
  - `"sqlite"` → imports and returns `AsyncSqliteSaver` from `langgraph-checkpoint-sqlite` with the specified path
  - `null`/`undefined`/unknown → returns `null`
  - Falls back to `InMemorySaver` for unrecognized modes
- [x] 3.3 Export `createCheckpointer` from `src/session/index.js` barrel
- [x] 3.4 Create `tests/unit/checkpointer.test.js` with tests for all modes (memory, sqlite, null, unknown fallback)
- [x] 3.5 Mock `langgraph-checkpoint` and `langgraph-checkpoint-sqlite` in tests — no real DB connections

## 4. Agent modifications — checkpointer parameter

- [x] 4.1 Update `createReactAgent` in `src/agent/react.js`:
  - Add optional third parameter `checkpointer` with JSDoc: `@param {BaseCheckpointSaver | null} [checkpointer=null]`
  - Pass `checkpointer` to `createReactAgentGraph({ llm: model, tools, checkpointer })` only when truthy
- [x] 4.2 JSDoc on `createReactAgent` updated to include `@param` for checkpointer
- [x] 4.3 Write tests in `tests/unit/react_agent_checkpoint.test.js`:
  - Test `createReactAgent` with `null` checkpointer (backward compatible)
  - Test `createReactAgent` with mock `InMemorySaver`
  - Verify `createReactAgentGraph` is called with `{ llm, tools, checkpointer }` when checkpointer provided

## 5. Agent modifications — config parameter with thread_id

- [x] 5.1 Update `callReactAgent` in `src/agent/react.js`:
  - Reorder parameters: `callReactAgent(agent, message, config, systemPrompt, callback)` where `config` is now the third parameter
  - When `config` is present and truthy, merge `config.configurable` into the invoke call: `agent.invoke({ messages: initMessages, ...config })`
  - Maintain backward compatibility when `config` is omitted (existing 3-arg: `agent, message, systemPrompt` still works via type detection — if third arg is a string, treat as systemPrompt)
- [x] 5.2 Update `callReactAgentStreaming` to accept config and pass `configurable` to `streamEvents`:
  - `streamOptions = { version: "v3", ...(config?.configurable && { configurable: config.configurable }) }`
  - Pass `config` parameter from `callReactAgent` into `callReactAgentStreaming`
- [x] 5.3 Write tests in `tests/unit/react_agent_checkpoint.test.js` for `callReactAgent`:
  - Test non-streaming invocation with `configurable: { thread_id }`
  - Test streaming invocation with `configurable: { thread_id }`
  - Test backward-compatible invocation without config
  - Test error propagation (checkpointer errors re-thrown unchanged)

## 6. index.js wiring

- [x] 6.1 In `index.js`, import `createCheckpointer` from `src/session/checkpointer.js`
- [x] 6.2 Create checkpointer instance: `const checkpointer = createCheckpointer(config.persistence)`
- [x] 6.3 Update agent compilation to include checkpointer: `const agent = createReactAgent(model, tools, checkpointer)`
- [x] 6.4 Update `callProvider` function to pass thread_id config: `callReactAgent(agent, message, { configurable: { thread_id: sessionId } }, systemPrompt, streamingCallback)`
- [x] 6.5 No changes needed for `dispatchProvider` — it already delegates to `callProvider` which now includes the thread_id
- [x] 6.6 Update `tests/unit/react_agent_checkpoint.test.js` with an integration test that mocks the full `callProvider` path with checkpointer

## 7. TUI streaming connection

- [x] 7.1 In `src/tui/app.js`, the `dispatchProvider` callback receives `(message, sessionState, callback)` from the App props
- [x] 7.2 The App receives the `sessionId` as a prop (already exported from `index.js`), thread_id must flow through
- [x] 7.3 Update the TUI `App` component to accept `sessionId` as an additional prop and thread id flows through `dispatchProvider`
- [x] 7.4 `dispatchProvider` in `index.js` is a closure — it needs a bound `threadId` that the TUI uses. Update the `dispatchProvider` implementation to accept an optional `threadId` parameter and pass it as config
- [x] 7.5 In `App` component, pass `sessionState.sessionId` (from `sessionState.getState()` or directly as a prop) through the `dispatchProvider` call in `handleChat`
- [x] 7.6 This ensures the TUI's streaming invocations use the same `thread_id` as the CLI

## 8. Spec files

- [x] 8.1 Create `specs/checkpointer/spec.md` — new capability for checkpointer factory module
- [x] 8.2 Create `specs/react-agent/spec.md` — new spec defining checkpointer parameter and config/thread_id requirements
- [x] 8.3 Create `specs/session-management/spec.md` — delta spec adding thread_id requirement to existing session management capability
- [x] 8.4 Create `specs/config-system/spec.md` — delta spec adding persistence config section to existing config system capability

## 9. Verify

- [x] 9.1 Run `npm run lint` (oxlint + oxfmt) and ensure zero errors
- [x] 9.2 Run `npm run test` and ensure all tests pass
- [x] 9.3 Run `npm run coverage` and ensure 100% coverage on all changed and new files
