## 1. Core Transformer Implementation

- [x] 1.1 Create `src/stream/transformers/turn.js` — implement `createTurnTransformer()` following the `StreamTransformer` pattern:
  - `init()` — create a `StreamChannel.local<TurnEvent>()` for the turn event log
  - `process()` — watch `values`/`updates` channel for new `HumanMessage` → emit `turn:start`; track tool calls from `tools` channel; detect terminal state (no pending tool calls + last message is `AIMessage` with content) → emit `turn:end`
  - `onRegister()` — receive `StreamEmitter.push()` for synthetic event emission
  - `finalize()` / `fail()` — cleanup
  - Use `Map<string, boolean>` keyed by tool call ID for tool tracking (not a simple counter)
  - Track tool calls across all namespaces (not just root)
  - Guard against re-entrant self-processing
- [x] 1.2 Create `src/stream/transformers/index.js` — barrel export for `createTurnTransformer`

## 2. Wire into Orchestrator

- [x] 2.1 In `src/agent/deepAgents.js`, import `createTurnTransformer` and pass it via `streamTransformers` to `createDeepAgent()`:
  ```js
  import { createTurnTransformer } from "../stream/transformers/index.js";
  ```
  Add `streamTransformers: [() => createTurnTransformer()]` to the `createDeepAgent()` call

## 3. Unit Tests

- [x] 3.1 Create `tests/unit/stream/transformers/turn.test.js` with unit tests for:
  - `turn:start` emitted on HumanMessage entry
  - `turn:end` emitted only after all tool calls resolve and AIMessage with content appears
  - Tool call tracking (start → increment, finish → decrement)
  - Edge cases: empty user message, zero tool calls, nested subagent delegations, error paths
  - Follow project testing conventions (node:test, assert, mocking patterns from existing tests)

## 4. Integration Test

- [ ] 4.1 Create `tests/integration/turn-transformer.test.js` with integration test:
  - Wire the transformer into a real agent invocation
  - Verify `turn:start`/`turn:end` events appear in correct order
  - Test with tool calls and without

## 5. Verification

- [x] 5.1 Run `npm run test` — all tests passing (3632 tests)
- [x] 5.2 Run `npm run lint` — lint clean
- [x] 5.3 Run `npm run coverage` — coverage maintained (95.80%)
