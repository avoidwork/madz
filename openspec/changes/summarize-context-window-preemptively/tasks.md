## 1. Preemptive Context-Window Estimate

- [x] 1.1 Add a preemptive context-window estimate to `src/provider/summarizationMiddleware.js` that computes input tokens via `model.getNumTokensFromMessages(messages)`, adds tool tokens, and adds the configured `maxTokens` output budget — mirroring `estimateCost()` in `src/provider/tokenBudgetMiddleware.js`.
- [x] 1.2 Resolve the model's context window (from the model profile `maxInputTokens`, falling back to the configured `contextWindow`) and compact before dispatch when the estimated total (input + output) exceeds it.

## 2. Wire Model and MaxTokens Through the Factory

- [x] 2.1 Update `createSummarizationMiddlewareFromConfig` in `src/provider/summarizationMiddleware.js` to accept `model` and `maxTokens` options and use them for the preemptive estimate.
- [x] 2.2 Update `src/agent/deepAgents.js` to pass `model` and `maxTokens` (from `providerConfig.maxTokens`) into `createSummarizationMiddlewareFromConfig`.

## 3. Tests

- [x] 3.1 Add `tests/unit/provider/summarizationMiddleware.test.js` coverage for the preemptive path: a request whose input + output would exceed the window compacts before dispatch.
- [x] 3.2 Verify the existing factory tests still pass (enabled/disabled/missing trigger/keep).

## 4. Verification

- [x] 4.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions.
