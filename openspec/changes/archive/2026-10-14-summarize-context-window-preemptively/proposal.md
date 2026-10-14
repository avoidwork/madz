## Why

The summarization middleware does not compact the context window preemptively. In long-running sessions it fails to compress before the model's context window is exceeded, causing repeated 400 context-window errors. The middleware only fires when the input token count (estimated via `countTokensApproximately`, chars/4) exceeds a fixed trigger (80% of context length). It does not account for expected output tokens, so a long response can push input + output over the window, causing 400 errors that are handled reactively (compact + re-send) rather than preemptively.

## What Changes

- Add a preemptive context-window check in `src/provider/summarizationMiddleware.js` that estimates the total cost (input + expected output) before dispatch.
- Account for the configured `maxTokens` (output budget) in the estimate so a long response is accounted for.
- Compact when input + output exceeds the model's context window, before the request is sent.
- Use the real model tokenizer (`model.getNumTokensFromMessages`) for the estimate, mirroring `estimateCost()` in `src/provider/tokenBudgetMiddleware.js`.
- Thread `model` and `maxTokens` into `createSummarizationMiddlewareFromConfig` from `src/agent/deepAgents.js`.
- Add test coverage for the preemptive path in `tests/unit/provider/summarizationMiddleware.test.js`.

## Capabilities

### New Capabilities
- `summarization-preemptive-compaction`: The summarization middleware estimates the current context window usage (input + expected output) before dispatching and compacts the conversation when the total would exceed the model's context window.

### Modified Capabilities
- `summarization-config`: The summarization middleware factory now accepts `model` and `maxTokens` options and performs a preemptive context-window estimate before dispatch, in addition to the existing trigger-based compaction.

## Impact

- `src/provider/summarizationMiddleware.js` — add the preemptive context-window estimate and compaction trigger.
- `src/agent/deepAgents.js` — pass `model` and `maxTokens` into `createSummarizationMiddlewareFromConfig`.
- `tests/unit/provider/summarizationMiddleware.test.js` — add coverage for the preemptive path.
