## Context

GitHub Copilot signals rate limiting with HTTP 403, not 429. The OpenAI SDK's `shouldRetry` method (`node_modules/openai/client.js`) only retries on 408, 409, 429, and >=500 — it never retries 403. So a Copilot 403 rate-limit response passes straight through even when `maxRetries` is configured, surfacing as a hard error to the user.

The agent dispatch path calls `model.bindTools()` → `withConfig()`, which constructs a NEW model object. Instance-property overrides of `invoke`/`stream` are orphaned and never fire on that path. This is a known trap in this codebase (see the `langchain_bindtools_orphan_patch` memory). The correct seam for wrapping the model call is a `wrapModelCall` middleware registered on `createDeepAgent`, which survives the `bindTools()` rebuild because it is part of the agent's chain, not the model.

## Goals / Non-Goals

**Goals:**
- Retry Copilot 403 rate-limit responses transparently, up to 3 retries after the initial attempt.
- Gate the retry to `github-copilot` connections only; other providers are unaffected.
- Honor the `retry-after` header for the delay, defaulting to 5s when absent.
- Keep the retry logic in a `wrapModelCall` middleware so it survives `bindTools()`.

**Non-Goals:**
- No changes to the OpenAI SDK's own retry behavior for non-Copilot providers.
- No changes to the token-budget middleware or its 429 handling.
- No new config schema fields; the retry count is fixed at 3.
- No retry of 429 or >=500 (the SDK already handles those) or 400 (the context-window path).

## Decisions

### Decision 1: Use a `wrapModelCall` middleware, not an instance patch
The retry lives in `createCopilotRetryMiddleware`, which returns a `createMiddleware({ wrapModelCall })`. This is the only seam that survives `bindTools()`. An instance-level patch of `model.invoke`/`model.stream` would be orphaned by `withConfig()` and never fire. Alternative (rejected): patching the model instance — the exact trap from the `langchain_bindtools_orphan_patch` memory.

### Decision 2: Gate to Copilot only
The middleware is registered in `createDeepAgent` only when `providerConfig.type === "github-copilot"`. For other providers it is not added to the chain, so there is zero overhead and no behavior change. Alternative (rejected): registering it unconditionally would add an unnecessary retry layer to OpenAI/other providers that already handle 429/5xx via the SDK.

### Decision 3: Retry only 403
Copilot uses 403 for rate limiting. The middleware's `isCopilotRateLimitError` checks `err.status === 403` (or `err.response.status === 403`). It deliberately does not retry 429 or >=500 (the SDK already does) or 400 (the context-window compaction path in the token-budget middleware handles that). Alternative (rejected): retrying all errors would mask genuine auth/validation failures.

### Decision 4: Fixed `maxRetries: 3`
The retry count is hardcoded to 3 per the user's explicit requirement. It is not pulled from `rateLimit.maxRetries` (which is 6 and semantically governs the SDK's own 429/5xx retries). Alternative (rejected): reusing `rateLimit.maxRetries` would conflate two independent retry policies.

### Decision 5: Honor `retry-after`, default 5s
The middleware reuses `getRetryDelayMs` from `openai.js`, which prefers the `retry-after` header (seconds or HTTP-date) and falls back to a default. The default here is `DEFAULT_COPILOT_RETRY_MS = 5000`. Alternative (rejected): a fixed delay ignores the server's explicit backoff hint.

## Risks / Trade-offs

- [Persistent 403] → The middleware retries up to 3 times, then surfaces the error. A sustained rate limit will still fail, but only after exhausting retries.
- [Long delay on retry-after] → If the server returns a large `retry-after`, the retry could block the dispatch for that duration. Mitigation: the delay is bounded by the server's hint, which is the correct backoff.
- [Middleware ordering] → The middleware must be registered LAST in the chain so it is innermost and retries the raw model call. If registered earlier, the token-budget middleware would charge the window for each retry attempt. Mitigation: register it after image-dispatch and before token-budget, matching the existing ordering convention.
