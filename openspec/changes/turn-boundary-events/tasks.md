## 1. Core Transformer Implementation

- [ ] 1.1 Create `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/turn.ts` — implement `createTurnTransformer()` with `StreamTransformer<TurnProjection>` interface, including `init()`, `process()`, `onRegister()`, `finalize()`, and `fail()` methods
- [ ] 1.2 Create `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/index.ts` — barrel export for `createTurnTransformer` and `TurnEvent` type

## 2. Package Exports

- [ ] 2.1 Add `createTurnTransformer` and `TurnEvent` exports to `tmp/deepagentsjs/libs/deepagents/src/index.ts`

## 3. Type Tests

- [ ] 3.1 Add type test in `tmp/deepagentsjs/libs/deepagents/src/stream.test-d.ts` verifying `run.extensions.turns` is `AsyncIterable<TurnEvent>` and events yield correct types

## 4. Unit Tests

- [ ] 4.1 Create `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/turn.test.ts` with unit tests for turn boundary detection, tool call tracking, edge cases, and error paths

## 5. Integration Test

- [ ] 5.1 Create `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/turn.int.test.ts` with integration test using real `createDeepAgent()` invocation

## 6. Verification

- [ ] 6.1 Run `pnpm test` and `pnpm typecheck` from `tmp/deepagentsjs/libs/deepagents` to confirm no regressions
