## 1. Dependencies

- [ ] 1.1 Add `langgraph-checkpoint` to `package.json` as a dev dependency (provides `InMemorySaver` for experimentation and testing)
- [ ] 1.2 Add `langgraph-checkpoint-sqlite` to `package.json` as an optional runtime dependency (provides `AsyncSqliteSaver` for persistent checkpoints)
- [ ] 1.3 Run `npm install` to install the new dependencies

## 2. Config schema

- [ ] 2.1 Create `PersistenceSchema` in `src/config/schemas.js` with `mode` (enum: "memory" | "sqlite", default: "memory") and `sqlite_path` (string, default: "memory/checkpoints.db")
- [ ] 2.2 Add `persistence` key to `ConfigSchema` using `PersistenceSchema`
- [ ] 2.3 Add `persistence` entry to `DEFAULT_CONFIG` exporting default values
- [ ] 2.4 Update `config.yaml` to include `persistence:` section with `mode: memory`
- [ ] 2.5 Create `tests/unit/config_persistence.test.js` with tests for the schema validation (memory mode default, sqlite mode, invalid mode fallback)

## 3. Checkpointer factory module

- [ ] 3.1 Create `src/session/checkpointer.js` with JSDoc comments on all public functions
- [ ] 3.2 Implement `createCheckpointer(persistenceConfig)` that switches on `mode`:
  - `"memory"` → imports and returns `InMemorySaver` from `langgraph-checkpoint`
  - `"sqlite"` → imports and returns `AsyncSqliteSaver` from `langgraph-checkpoint-sqlite` with the specified path
  - `null`/`undefined`/unknown → returns `null`
  - Falls back to `InMemorySaver` for unrecognized modes
- [ ] 3.3 Export `createCheckpointer` from `src/session/index.js` barrel
- [ ] 3.4 Create `tests/unit/checkpointer.test.js` with tests for all modes (memory, sqlite, null, unknown fallback)
- [ ] 3.5 Mock `langgraph-checkpoint` and `langgraph-checkpoint-sqlite` in tests — no real DB connections

## 4. Agent modifications — checkpointer parameter

- [ ] 4.1 Update `createReactAgent` in `src/agent/react.js`:
  - Add optional third parameter `checkpointer` with JSDoc: `@param {BaseCheckpointSaver | null} [checkpointer=null]`
  - Pass `checkpointer` to `createReactAgentGraph({ llm: model, tools, checkpointer })` only when truthy
- [ ] 4.2 JSDoc on `createReactAgent` updated to include `@param` for checkpointer
- [ ] 4.3 Write tests in `tests/unit/react_agent_checkpoint.test.js`:
  - Test `createReactAgent` with `null` checkpointer (backward compatible)
  - Test `createReactAgent` with mock `InMemorySaver`
  - Verify `createReactAgentGraph` is called with `{ llm, tools, checkpointer }` when checkpointer provided

## 5. Agent modifications — config parameter with thread_id

- [ ] 5.1 Update `callReactAgent` in `src/agent/react.js`:
  - Reorder parameters: `callReactAgent(agent, message, config, systemPrompt, callback)` where `config` is now the third parameter
  - When `config` is present and truthy, merge `config.configurable` into the invoke call: `agent.invoke({ messages: initMessages, ...config })`
  - Maintain backward compatibility when `config` is omitted (existing 3-arg: `agent, message, systemPrompt` still works via type detection — if third arg is a string, treat as systemPrompt)
- [ ] 5.2 Update `callReactAgentStreaming` to accept config and pass `configurable` to `streamEvents`:
  - `streamOptions = { version: "v3", ...(config?.configurable && { configurable: config.configurable }) }`
  - Pass `config` parameter from `callReactAgent` into `callReactAgentStreaming`
- [ ] 5.3 Write tests in `tests/unit/react_agent_checkpoint.test.js` for `callReactAgent`:
  - Test non-streaming invocation with `configurable: { thread_id }`
  - Test streaming invocation with `configurable: { thread_id }`
  - Test backward-compatible invocation without config
  - Test error propagation (checkpointer errors re-thrown unchanged)

## 6. index.js wiring

- [ ] 6.1 In `index.js`, import `createCheckpointer` from `src/session/checkpointer.js`
- [ ] 6.2 Create checkpointer instance: `const checkpointer = createCheckpointer(config.persistence)`
- [ ] 6.3 Update agent compilation to include checkpointer: `const agent = createReactAgent(model, tools, checkpointer)`
- [ ] 6.4 Update `callProvider` function to pass thread_id config: `callReactAgent(agent, message, { configurable: { thread_id: sessionId } }, systemPrompt, streamingCallback)`
- [ ] 6.5 No changes needed for `dispatchProvider` — it already delegates to `callProvider` which now includes the thread_id
- [ ] 6.6 Update `tests/unit/react_agent_checkpoint.test.js` with an integration test that mocks the full `callProvider` path with checkpointer

## 7. TUI streaming connection

- [ ] 7.1 In `src/tui/app.js`, the `dispatchProvider` callback receives `(message, sessionState, callback)` from the App props
- [ ] 7.2 The App receives the `sessionId` as a prop (already exported from `index.js`), thread_id must flow through
- [ ] 7.3 Update the TUI `App` component to accept `sessionId` as an additional prop and thread id flows through `dispatchProvider`
- [ ] 7.4 `dispatchProvider` in `index.js` is a closure — it needs a bound `threadId` that the TUI uses. Update the `dispatchProvider` implementation to accept an optional `threadId` parameter and pass it as config
- [ ] 7.5 In `App` component, pass `sessionState.sessionId` (from `sessionState.getState()` or directly as a prop) through the `dispatchProvider` call in `handleChat`
- [ ] 7.6 This ensures the TUI's streaming invocations use the same `thread_id` as the CLI

## 8. Spec files

- [ ] 8.1 Create `specs/checkpointer/spec.md` — new capability for checkpointer factory module
- [ ] 8.2 Create `specs/react-agent/spec.md` — new spec defining checkpointer parameter and config/thread_id requirements
- [ ] 8.3 Create `specs/session-management/spec.md` — delta spec adding thread_id requirement to existing session management capability
- [ ] 8.4 Create `specs/config-system/spec.md` — delta spec adding persistence config section to existing config system capability

## 9. Verify

- [ ] 9.1 Run `npm run lint` (oxlint + oxfmt) and ensure zero errors
- [ ] 9.2 Run `npm run test` and ensure all tests pass
- [ ] 9.3 Run `npm run coverage` and ensure 100% coverage on all changed and new files
