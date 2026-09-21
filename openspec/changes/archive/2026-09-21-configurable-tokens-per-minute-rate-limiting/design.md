## Context

The `src/provider/openai.js` module provides a thin factory (`createChatModel`) that instantiates `ChatOpenAI` from `@langchain/openai`. Configuration flows from `config.yaml` through `src/config/loader.js` → `src/config/schemas/providers.js` (Zod validation) → `createChatModel()`.

The work environment imposes a 100k tokens-per-minute limit on LLM calls. Today the harness has no client-side token pacing: it relies entirely on the provider's own rate limiting, and a bare `429` (no `retry-after` hint) surfaces as an immediate error. The `requestsPerMinute` value in the provider config is cosmetic — it is not enforced anywhere.

The `RateLimitSchema` currently captures `requestsPerMinute`, `maxRetries`, and `maxConcurrency`. This change adds `maxTokensMinute` and introduces a rolling token-budget throttle that paces outgoing requests against a 60-second window.

## Goals / Non-Goals

**Goals:**
- Add `maxTokensMinute` to `RateLimitSchema` (non-negative integer, default `0` = disabled)
- Build a rolling 60-second token window module (`src/provider/tokenBudget.js`) exposing `consume(tokens)`, `current()`, and `waitForCapacity(estimatedTokens)`
- Estimate request token cost (input tokens via `calculateConversationTokens` + `maxTokens` output budget)
- Wire the throttle into `createChatModel()` dispatch: when `maxTokensMinute > 0`, `await waitForCapacity(estimatedCost)` then `consume(estimatedCost)` before invoking the model
- Attribute `429` rate-limit errors to an exceeded token budget when the rolling window exceeds `maxTokensMinute`
- Add unit test coverage

**Non-Goals:**
- Request-count throttling (the constraint is token-based, not request-count-based)
- Hard-rejecting over-budget requests (the requirement is to delay, not to fail)
- Changes to other providers (OpenRouter, Fal)
- Integration or end-to-end tests

## Decisions

1. **`maxTokensMinute` defaults to `0` (disabled):**
   - `0` means the throttle is off, preserving existing behavior for all current configs.
   - Schema uses `z.number().int().min(0).default(0)`.

2. **Rolling window is a 60-second sliding window:**
   - Each `consume(tokens)` records `{ timestamp, tokens }` in an array.
   - `current()` evicts entries older than 60 seconds and returns the sum of remaining tokens.
   - `waitForCapacity(estimatedTokens)` resolves immediately if `current() + estimatedTokens <= maxTokensMinute`; otherwise it waits (via `setTimeout`) until the window has room, re-checking after each eviction.

3. **Token cost estimation:**
   - Input tokens are computed via `calculateConversationTokens(conversation, modelName, encoding)` from `src/tui/contextTokens.js`.
   - Output budget is `config.maxTokens`.
   - Estimated cost = input tokens + `maxTokens`.

4. **Throttle is a consideration, not a hard failure:**
   - `waitForCapacity` delays the request until the window has room; it never rejects.
   - This matches the issue's requirement to "pace requests rather than reject them."

5. **`429` attribution:**
   - When a `429` is caught, compare `current()` against `maxTokensMinute`. If the rolling window exceeds the budget, log it as an exceeded token budget rather than an opaque provider error.

6. **Wiring location:**
   - The throttle is wired in `createChatModel()` in `src/provider/openai.js`. The model factory receives the full provider config (including `rateLimit.maxTokensMinute`), so both the orchestrator (line 118) and per-agent (line 69) model instances in `src/agent/deepAgents.js` flow through automatically.

## Risks / Trade-offs

- **Risk:** `waitForCapacity` could block indefinitely if a single request's estimated cost exceeds the entire budget and the window never empties.
  → **Mitigation:** The window evicts entries after 60 seconds, so capacity always frees up over time. A single request larger than the whole budget will wait until the window drains, then proceed.

- **Risk:** Token estimation is an approximation (tiktoken may be unavailable, falling back to character-count heuristic).
  → **Mitigation:** The estimate is a conservative upper bound for pacing purposes; the provider's own rate limiting remains the backstop.

- **Risk:** Adding a delay to dispatch could slow throughput when the budget is near capacity.
  → **Mitigation:** The throttle only activates when `maxTokensMinute > 0`; default `0` keeps existing behavior.

- **Trade-off:** The throttle is client-side and best-effort — it cannot perfectly predict provider token accounting.
  → **Mitigation:** It reduces the frequency of `429`s and improves error attribution; it does not replace provider-side limits.

## Migration Plan

No migration needed. The change is purely additive:
1. Deploy the code change.
2. Existing configs validate successfully (`maxTokensMinute` defaults to `0`).
3. Operators who want token pacing add `maxTokensMinute` to their provider config under `rateLimit`.

## Open Questions

None.
