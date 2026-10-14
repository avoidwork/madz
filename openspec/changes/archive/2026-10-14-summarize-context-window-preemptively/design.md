## Context

The summarization middleware (`src/provider/summarizationMiddleware.js`) currently delegates entirely to deepagents' `createSummarizationMiddleware`, which fires only when the input token count (estimated via `countTokensApproximately`, chars/4) exceeds a fixed trigger (80% of context length, derived at init in `src/agent/deepAgents.js`). It does not account for expected output tokens, so a long response can push input + output over the model's context window, causing 400 context-window errors that are handled reactively (compact + re-send) rather than preemptively.

The token-budget middleware (`src/provider/tokenBudgetMiddleware.js`) already estimates cost preemptively: `inputTokens` (via `model.getNumTokensFromMessages`) + `toolTokens` + `outputBudget` (from `options.maxTokens`). This is the pattern the summarization middleware should mirror.

## Goals / Non-Goals

**Goals:**
- Add a preemptive context-window check before dispatch that estimates total cost (input + expected output) using the model tokenizer.
- Account for the configured `maxTokens` (output budget) in the estimate.
- Compact when input + output exceeds the model's context window, before the request is sent.
- Use the real model tokenizer (`model.getNumTokensFromMessages`) for the trigger estimate.

**Non-Goals:**
- No config schema change (the `summarization` section shape is unchanged).
- No change to the existing trigger-based compaction path or the `keep` policy.
- No change to the token-budget middleware's rate-limit behavior.

## Decisions

**Decision 1: Mirror `estimateCost()` from the token-budget middleware.**
The preemptive check reuses the same estimation approach as `estimateCost()` in `src/provider/tokenBudgetMiddleware.js`: `inputTokens` via `model.getNumTokensFromMessages(messages)` + `toolTokens` via `countTokensApproximately([], tools)` + `outputBudget` from `maxTokens`. This ensures the threshold matches the model's actual tokenization rather than the chars/4 approximation.

**Decision 2: Thread `model` and `maxTokens` into `createSummarizationMiddlewareFromConfig`.**
The factory currently receives only `{ backend, config }`. It needs the model instance (for `getNumTokensFromMessages`) and the configured `maxTokens` (output budget) to perform the preemptive estimate. `src/agent/deepAgents.js` already has both in scope when it calls the factory.

**Decision 3: Wrap the deepagents middleware's `wrapModelCall`.**
Rather than reimplementing deepagents' summarization logic, wrap the returned middleware's `wrapModelCall` with a preemptive check. Before delegating to the inner `wrapModelCall`, estimate the total cost; if it would exceed the context window, force a summarization by invoking the middleware's own compaction path (via a forced trigger) before dispatching. This preserves deepagents' summarization behavior while adding the preemptive trigger.

**Decision 4: Resolve the context window from the model.**
The context window is derived from the model's profile (`maxInputTokens`) when available, falling back to the configured `contextWindow` value. This mirrors how deepagents resolves `maxInputTokens` internally.

## Risks / Trade-offs

- [Double summarization] → The preemptive check fires only when the total (input + output) exceeds the window; the existing trigger-based check still applies. If both fire, the preemptive path compacts first and the inner middleware sees a smaller message set, so it will not re-summarize.
- [Estimate divergence] → `getNumTokensFromMessages` is the model's real tokenizer, so the estimate is accurate for the provider. When the model lacks this method, the preemptive check is skipped and the existing behavior is preserved.
- [Output budget `-1`] → `maxTokens: -1` means unlimited; treat it as 0 (no output budget) so the estimate is not off by one, matching `estimateCost()`.
