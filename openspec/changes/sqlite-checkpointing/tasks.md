## 1. Config Schema

- [x] 1.1 Add `agent.checkpoints` schema (`enabled: bool, default: true`) to `src/config/schemas.js`
- [x] 1.2 Set default values for `agent.checkpoints` in `DEFAULT_CONFIG` in `src/config/schemas.js`

## 2. Checkpointer Module

- [x] 2.1 Create `src/agent/checkpointer.js` with `createCheckpointer(config)` factory; hardcode db path `memory/checkpoints/langgraph.db`
- [x] 2.2 Factory imports `SQLiteSaver` from `@langchain/langgraph-checkpoint-sqlite`
- [x] 2.3 Factory returns `{ SaverConstructor, checkpointerConfig }` when enabled, `{ null, null }` when disabled
- [x] 2.4 Factory catches native binding load failures and returns `{ null, null }` with warning log
- [x] 2.5 Create `tests/unit/checkpointer.test.js` with tests for enabled, disabled, and fallback paths

## 3. Agent Module Updates

- [x] 3.1 Update `createReactAgent` in `src/agent/react.js` to accept optional 3rd `checkpointer` parameter
- [x] 3.2 Pass `checkpointer` to `createReactAgentGraph` when provided
- [x] 3.3 Update `callReactAgent` sync path to pass `{ configurable: { thread_id } }` when threadId provided
- [x] 3.4 Update `callReactAgentStreaming` to pass `{ configurable: { thread_id } }` in `streamEvents` config
- [x] 3.5 Update `react_agent.test.js` with tests for checkpointer param and thread_id config passing

## 4. Wiring in index.js

- [x] 4.1 Import `createCheckpointer` from `src/agent/checkpointer.js` in `index.js`
- [x] 4.2 Instantiate checkpointer at startup before agent creation, passing config
- [x] 4.3 Pass checkpointer to `createReactAgent(model, tools, checkpointer)`
- [x] 4.4 Pass `sessionId` as `thread_id` in `callReactAgent` invocation

## 5. Testing & Verification

- [x] 5.1 Run `npm run lint` — no lint errors
- [x] 5.2 Run `npm run test` — all tests pass
- [x] 5.3 Run `npm run coverage` — 100% coverage maintained (pre-commit enforced)
