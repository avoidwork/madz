## Context

The `src/provider/openai.js` module provides a thin factory (`createChatModel`) that instantiates `ChatOpenAI` from the `@langchain/openai` package. Configuration flows from `config.yaml` through `src/config/loader.js` → `src/config/schemas/providers.js` (Zod validation) → `createChatModel()`.

Currently, the `RateLimitSchema` only captures `requestsPerMinute`. The `ChatOpenAI` constructor accepts `maxRetries` and `maxConcurrency` parameters, but these are not exposed through the provider config — they rely on SDK defaults.

## Goals / Non-Goals

**Goals:**
- Expose `maxRetries` and `maxConcurrency` as configurable fields in `RateLimitSchema`
- Wire these values through `createChatModel()` to the `ChatOpenAI` constructor
- Maintain backward compatibility — existing configs continue to work
- Add unit test coverage

**Non-Goals:**
- Implementing actual rate limiting (throttling, queuing)
- Changes to other providers (OpenRouter, Fal)
- Integration tests or E2E tests
- Changes to `config.yaml` defaults

## Decisions

1. **Schema default for `maxRetries` is 6:**
   - The OpenAI SDK defaults to 2 retries. We choose 6 as a more defensive default suitable for agent workloads that may encounter transient failures.
   - Range 0–10 matches the OpenAI SDK's documented bounds.

2. **`maxConcurrency` is optional (not defaulted):**
   - Concurrency is a specialized concern. Most deployments don't need to tune it.
   - Passing `undefined` to the constructor lets LangChain use its internal defaults.
   - When set, it must be ≥ 1 (a concurrency of 0 would deadlock).

3. **Always pass `maxRetries`, conditionally pass `maxConcurrency`:**
   - `maxRetries` always has a schema default, so it's always present in validated config.
   - `maxConcurrency` is only added to the constructor options when explicitly set, avoiding accidental override of LangChain defaults.

4. **No new config.yaml changes required:**
   - Schema defaults handle the common case.
   - Operators who need custom values add them to their provider config under `rateLimit`.

## Risks / Trade-offs

- **Risk:** Setting `maxRetries` too high could cause long hangs on persistent failures.
  → **Mitigation:** Default of 6 is reasonable; operators can lower it. The OpenAI SDK also has internal timeout limits.

- **Risk:** Setting `maxConcurrency` too high could overwhelm the API or local resources.
  → **Mitigation:** Field is optional; default LangChain behavior is preserved when not set.

- **Trade-off:** Adding fields to `RateLimitSchema` increases the schema surface area.
  → **Mitigation:** Fields are optional (except `maxRetries` which has a default), so existing configs are unaffected.

## Migration Plan

No migration needed. The change is purely additive:
1. Deploy the code change.
2. Existing configs validate successfully (schema defaults apply).
3. Operators who want to tune retry/concurrency add values to their provider config.

## Open Questions

None.
