## Why

The work environment imposes a 100k tokens-per-minute limit on LLM calls. The harness currently has no client-side token pacing: it relies entirely on the provider's own rate limiting, and a bare `429` (no `retry-after` hint) surfaces as an immediate error rather than being retried. The `requestsPerMinute` value in the provider config is cosmetic — it is not enforced anywhere. This change makes the harness aware of the token budget so it can delay sending a message when the rolling window is near capacity, and can attribute rate-limit errors to an exceeded token budget.

## What Changes

- Add `maxTokensMinute` to `RateLimitSchema` in `src/config/schemas/providers.js` as a non-negative integer defaulting to `0` (disabled).
- Create a new rolling 60-second token window module `src/provider/tokenBudget.js` exposing `consume(tokens)`, `current()`, and `waitForCapacity(estimatedTokens)`.
- Wire the throttle into `createChatModel()` in `src/provider/openai.js`: when `maxTokensMinute > 0`, estimate the request token cost (input via `calculateConversationTokens` + `maxTokens` output budget), `await waitForCapacity(estimatedCost)`, then `consume(estimatedCost)` before invoking the model.
- Attribute `429` rate-limit errors: when the rolling window exceeds `maxTokensMinute`, log it as an exceeded token budget rather than an opaque provider error.
- Document a `maxTokensMinute` example (e.g., `100000`) under `providers.openai.rateLimit` in `config.yaml`.
- Add unit tests in `tests/unit/provider/tokenBudget.test.js`.

## Capabilities

### New Capabilities
- `provider-token-budget`: Rolling 60-second token window that tracks consumed tokens, exposes current usage, and waits for capacity before a request is dispatched. When `maxTokensMinute` is `0`, the throttle is disabled.

### Modified Capabilities
- `provider-rate-limit-config`: The `RateLimitSchema` gains a `maxTokensMinute` field (non-negative integer, default `0` = disabled). The `createChatModel()` factory wires the token-budget throttle into dispatch and attributes `429` errors to an exceeded token budget.

## Impact

- **Affected code:** `src/config/schemas/providers.js`, `src/provider/openai.js`, `src/provider/tokenBudget.js` (new), `src/tui/contextTokens.js` (reused), `config.yaml`, `tests/unit/provider/tokenBudget.test.js` (new)
- **Config:** Existing `config.yaml` files continue to work; `maxTokensMinute` is optional with a default of `0` (disabled)
- **Dependencies:** No new npm packages; reuses existing `calculateConversationTokens` and `@langchain/openai`
- **Breaking changes:** None

## Non-goals

- Implementing request-count throttling (the constraint is token-based, not request-count-based)
- Hard-rejecting over-budget requests (the requirement is to delay, not to fail)
- Changes to other providers (OpenRouter, Fal)
- Integration or end-to-end tests
