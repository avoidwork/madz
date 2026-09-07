# Detailed Goals: Turn Boundary Events for deepagentsjs Event System

## Goal 1: Create Turn Boundary StreamTransformer
- **Scope:** Implement `createTurnTransformer()` in `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/turn.ts`
- **Key Requirements:**
  1. Implement `StreamTransformer<{ turns: AsyncIterable<TurnEvent> }>` interface
  2. In `init()`, create a `StreamChannel.local<TurnEvent>()` for the turn event log
  3. In `process()`, watch the `"values"`/`"updates"` channel for a new `HumanMessage` entering state → emit `{ type: "turn:start" }`
  4. Track active tool calls from the `"tools"` channel (tool-started → increment counter, tool-finished → decrement)
  5. Detect terminal state: no pending tool calls + last message is `AIMessage` with content → emit `{ type: "turn:end" }`
  6. Return `AsyncIterable<TurnEvent>` from the projection so consumers iterate `run.extensions.turns`
- **Acceptance Criteria:** Transformer correctly detects HumanMessage entry, tracks tool call state transitions, and emits turn:end only when all tool calls are resolved and an AIMessage with content is present
- **Dependencies:** `@langchain/langgraph` (already a dependency), `@langchain/core/messages` (already a dependency)
- **Risks/Edge Cases:** Empty user message (no content), agent that makes zero tool calls (direct response), agent with nested subagent delegations, concurrent turns, error/failure paths where the agent never produces a content-bearing AIMessage

## Goal 2: Export the Transformer
- **Scope:** Add barrel export in `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/index.ts` and re-export from package index
- **Key Requirements:**
  1. Create `stream/transformers/index.ts` barrel file if it doesn't exist
  2. Export `createTurnTransformer` function
  3. Export `TurnEvent` type
  4. Re-export from `index.ts` (package entry point)
- **Acceptance Criteria:** `createTurnTransformer` and `TurnEvent` are importable from `deepagents`

## Goal 3: Register in createDeepAgent() or Document Call-Site Pattern
- **Scope:** Either add as built-in transformer in `agent.ts` or document call-site registration
- **Key Requirements:**
  1. Option (b) from issue: Document call-site pattern — consumers register via `streamTransformers: [() => createTurnTransformer()]`
  2. Add JSDoc example showing usage
- **Acceptance Criteria:** Clear documentation exists showing how to use the transformer

## Goal 4: Add Type Tests
- **Scope:** Extend `stream.test-d.ts` with turn transformer type test
- **Key Requirements:**
  1. Verify `run.extensions.turns` is `AsyncIterable<{ type: "turn:start" | "turn:end" }>`
  2. Verify events are yielded in correct order for a simple agent invocation
- **Acceptance Criteria:** TypeScript compilation passes for the new test

## Goal 5: Write Unit Tests
- **Scope:** Add `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/turn.test.ts`
- **Key Requirements:**
  1. Mock `ProtocolEvent` sequences simulating a user message → tool calls → AI response cycle
  2. Verify `turn:start` is emitted on HumanMessage entry
  3. Verify `turn:end` is emitted only after all tool calls resolve and AIMessage with content appears
  4. Edge cases: empty user message, zero tool calls, nested subagent delegations, error paths
- **Acceptance Criteria:** All unit tests pass with `pnpm test`

## Goal 6: Write Integration Test
- **Scope:** Add integration test in `tmp/deepagentsjs/libs/deepagents/src/stream/transformers/turn.int.test.ts`
- **Key Requirements:**
  1. Create a real `createDeepAgent()` with the turn transformer
  2. Invoke with a user message that triggers tool calls
  3. Collect `run.extensions.turns` and verify start/end pair
- **Acceptance Criteria:** Integration test passes

## Goal 7: Verify
- **Scope:** Run `pnpm test` and `pnpm typecheck` from `tmp/deepagentsjs/libs/deepagents`
- **Key Requirements:**
  1. No regressions in existing tests
  2. New tests pass
  3. TypeScript compilation succeeds
- **Acceptance Criteria:** All tests pass, typecheck passes
