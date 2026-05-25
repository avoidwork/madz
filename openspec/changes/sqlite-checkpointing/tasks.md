## 1. Config Schema

- [ ] 1.1 Add `agent.checkpoints` schema (`enabled`, `dbPath`) to `src/config/schemas.js`
- [ ] 1.2 Set default values for `agent.checkpoints` in `DEFAULT_CONFIG` in `src/config/schemas.js`

## 2. Checkpointer Module

- [ ] 2.1 Create `src/agent/checkpointer.js` with `createCheckpointer(config)` factory
- [ ] 2.2 Factory imports `SQLiteSaver` from `@langchain/langgraph-checkpoint-sqlite`
- [ ] 2.3 Factory returns `{ SaverConstructor, checkpointerConfig }` when enabled, `{ null, null }` when disabled
- [ ] 2.4 Factory catches native binding load failures and returns `{ null, null }` with warning log
- [ ] 2.5 Create `tests/unit/checkpointer.test.js` with tests for enabled, disabled, and fallback paths

## 3. Agent Module Updates

- [ ] 3.1 Update `createReactAgent` in `src/agent/react.js` to accept optional 3rd `checkpointer` parameter
- [ ] 3.2 Pass `checkpointer` to `createReactAgentGraph` when provided
- [ ] 3.3 Update `callReactAgent` sync path to pass `{ configurable: { thread_id } }` when threadId provided
- [ ] 3.4 Update `callReactAgentStreaming` to pass `{ configurable: { thread_id } }` in `streamEvents` config
- [ ] 3.5 Update `react_agent.test.js` with tests for checkpointer param and thread_id config passing

## 4. Wiring in index.js

- [ ] 4.1 Import `createCheckpointer` from `src/agent/checkpointer.js` in `index.js`
- [ ] 4.2 Instantiate checkpointer at startup before agent creation, passing config
- [ ] 4.3 Pass checkpointer to `createReactAgent(model, tools, checkpointer)`
- [ ] 4.4 Pass `sessionId` as `thread_id` in `callReactAgent` invocation

## 5. Config & YAML

- [ ] 5.1 Add `agent.checkpoints:` section to `config.yaml` with defaults
- [ ] 5.2 Verify `loadConfig()` merges checkpoint defaults correctly

## 6. Testing & Verification

- [ ] 6.1 Run `npm run lint` — no lint errors
- [ ] 6.2 Run `npm run test` — all tests pass
- [ ] 6.3 Run `npm run coverage` — 100% coverage maintained (pre-commit enforce
