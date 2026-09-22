## Why

The `rateLimit.maxTokensMinute` config value does not enforce the configured tokens-per-minute budget. The throttle is reached on the main dispatch path, but it paces on a broken token estimate (the configured tiktoken encoding name is passed to a model-keyed API and silently falls back to a char/4 heuristic), maintains an independent budget per model instance (orchestrator + each subagent), never reconciles against the API's reported usage, has no concurrency guard, and charges the window for failed requests. The number in `config.yaml` is therefore not the number of tokens that actually flow.

## What Changes

- **Fix encoder resolution** in `src/tui/contextTokens.js`: stop passing the tiktoken *encoding* name to `encoding_for_model` (which is keyed by model name). Resolve the encoder from the model name, with an explicit encoding→model map for configured encodings, so tiktoken is actually used instead of silently falling back to char/4.
- **Make the budget global**: hoist a single shared `createTokenBudget` instance out of `createChatModel` so the orchestrator and all subagents pace against one rolling window, not `N × maxTokensMinute`.
- **Reconcile with actual usage**: after dispatch, read `usage` (prompt + completion tokens) from the response and adjust the consumed entry to the real total instead of the pre-dispatch estimate.
- **Add a concurrency guard**: make `waitForCapacity` + `consume` atomic (single lock/queue in `tokenBudget.js`) so concurrent dispatches cannot overshoot the window.
- **Re-pace the 429 retry**: call `waitForCapacity` again before re-dispatching, and only charge the window for the attempt that succeeds.
- **Charge only on success**: a failed dispatch no longer consumes budget.
- **Document `maxConcurrency`**: clarify that actual concurrency comes from parallel subagents, not this option; the shared budget is the enforcement point.
- Add unit tests: encoder resolution uses tiktoken for known models; budget enforces the ceiling under concurrent calls; a single shared budget is used across multiple model instances.

## Capabilities

### New Capabilities

- `token-estimation`: Defines how conversation token counts are computed — encoder resolution from model name with an explicit encoding→model map, tiktoken as the primary path, and char/4 as a last-resort fallback only when tiktoken is genuinely unavailable.

### Modified Capabilities

- `provider-token-budget`: The budget gains an atomic `reserve` (check-and-consume under a single lock), a `reconcile` operation to adjust a consumed entry to actual usage, and a shared/global instance requirement so all model instances pace against one window.
- `provider-rate-limit-config`: `createChatModel` wires a single shared budget (not a per-instance one), charges the window only on successful dispatch, re-paces 429 retries through `waitForCapacity`, and documents that `maxConcurrency` does not bound what the budget sees.

## Impact

- **Affected code:** `src/tui/contextTokens.js`, `src/provider/tokenBudget.js`, `src/provider/openai.js`, `src/agent/deepAgents.js` (budget hoisting), `tests/unit/provider/tokenBudget.test.js`, `tests/unit/tui/contextTokens.test.js`.
- **No API changes:** `createChatModel(config)` signature unchanged; `createTokenBudget` gains optional methods, existing API preserved.
- **No dependency changes:** tiktoken is already a dependency.
- **Behavior change:** token pacing becomes a hard, shared, usage-reconciled ceiling — previously it was an advisory, per-instance, estimate-based pacer.

## Non-goals

- Changing the `maxTokensMinute` Zod schema or config surface.
- Adding new rate-limit dimensions (requests/minute, cost-based).
- Modifying the LangChain `ChatOpenAI` internals or the deepagents graph.
- Changing retry policy beyond re-pacing the existing single 429 retry.
