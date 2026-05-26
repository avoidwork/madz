## 1. Dependency and Config

- [x] 1.1 Add `@langchain/langgraph-checkpoint-sqlite` to `package.json` dependencies and run `npm install`
- [x] 1.2 Add `sqlite:` section with `path: memory/checkpoints.db` to `config.yaml`
- [x] 1.3 Add `sqliteSchema` Zod schema to `src/config/schemas.js` for the `sqlite` config object
- [x] 1.4 Wire `sqliteSchema` into the config merge logic in `src/config/loader.js`

## 2. Core Graph Module

- [x] 2.1 Create `src/agent/state_graph.js` with `buildCheckpointedGraph(model, tools, dbPath)` function
- [x] 2.2 Define `State = Annotation.Root({ messages: Annotation({ reducer: ... }) })` matching the prebuilt agent's message shape
- [x] 2.3 Instantiate `SqliteSaver(dbPath)` and compile the `StateGraph` with the checkpointer
- [x] 2.4 Expose the compiled graph from `buildCheckpointedGraph()` return value

## 3. Refactor Agent Wrapper

- [x] 3.1 Update `src/agent/react.js` to import `buildCheckpointedGraph` from `state_graph.js`
- [x] 3.2 Add a `graphCache` Map keyed by `${dbPath}:${model.modelName}` for graph reuse
- [x] 3.3 Update `createReactAgent()` to delegate to `buildCheckpointedGraph()` with cached result
- [x] 3.4 Ensure `callReactAgent()` and `callReactAgentStreaming()` signatures and return types are unchanged

## 4. Session Thread Integration

- [x] 4.1 Update `src/session/factory.js` to generate and return `threadId` alongside `sessionId`
- [x] 4.2 Update `index.js` to destructure `threadId` from `createSession()` result
- [x] 4.3 Pass `{ configurable: { thread_id: threadId } }` on every graph invocation in `index.js`
- [x] 4.4 Update the conversation handler to accumulate messages via the graph state instead of `sessionState.addExchange()` (or keep both for backward compatibility)

## 5. Thread Enumeration Utility

- [x] 5.1 Create `src/session/loader.js` with `listThreadIds(saver)` async function
- [x] 5.2 Implement enumeration using `saver.list({})` iterator over checkpoint tuples
- [x] 5.3 Return a unique set of `thread_id` strings (empty array if no checkpoints)
- [x] 5.4 Export `listThreadIds` from `src/session/index.js`

## 6. Update Session Saver

- [x] 6.1 Update `src/session/saver.js` to mark JSON file export as optional/legacy behind a `session.memoryJsonExport` config flag
- [x] 6.2 Keep the function but emit a console warning if `memoryJsonExport` is true (deprecated path)

## 7. Tests

- [x] 7.1 Create `tests/unit/agent/state_graph.test.js` — test `buildCheckpointedGraph` compiles, state schema is correct, and checkpointer is attached
- [x] 7.2 Create `tests/unit/agent/state_graph.test.js` — test that graph invokes with checkpoint created (mock `SqliteSaver`)
- [x] 7.3 Update `tests/unit/session/factory.test.js` — verify `createSession` returns `threadId` field
- [x] 7.4 Create `tests/unit/session/loader.test.js` — test `listThreadIds` returns unique thread IDs and empty array on fresh DB
- [x] 7.5 Ensure all new and updated tests achieve 100% coverage

## 8. Verification

- [ ] 8.1 Run `npm run lint` — no errors
- [ ] 8.2 Run `npm run test` — all tests pass
- [ ] 8.3 Run `npm run coverage` — coverage report shows 100% and `coverage.txt` is regenerated
