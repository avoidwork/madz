## Why

Operators need fine-grained control over retry and concurrency behavior when calling OpenAI-compatible APIs. Currently, the ChatOpenAI provider factory uses SDK defaults for `maxRetries` and `maxConcurrency`, which may not suit all deployment scenarios — especially those using rate-limited endpoints or requiring strict concurrency bounds.

## What Changes

- Extend `RateLimitSchema` in `src/config/schemas/providers.js` with `maxRetries` (int, 0–10, default: 6) and `maxConcurrency` (int, 1+, optional)
- Update `createChatModel()` in `src/provider/openai.js` to pass these parameters to the `ChatOpenAI` constructor
- Update JSDoc in `src/provider/openai.js` to document the new properties
- Add unit tests in `tests/unit/provider.test.js` for both parameters

## Capabilities

### New Capabilities
- `provider-rate-limit-config`: Configurable retry and concurrency parameters for the ChatOpenAI provider via YAML configuration

### Modified Capabilities
- None — this adds new capability without changing existing behavior

## Impact

- **Affected code:** `src/config/schemas/providers.js`, `src/provider/openai.js`, `tests/unit/provider.test.js`
- **Config:** Existing `config.yaml` files continue to work; new fields are optional with sensible defaults
- **Dependencies:** No new dependencies; uses existing `@langchain/openai` SDK capabilities
- **Breaking changes:** None

## Non-goals

- Rate limiting implementation (throttling, queuing) — this change only wires config through
- Changes to other providers (OpenRouter, Fal)
- Integration or end-to-end tests
- Changes to `config.yaml` defaults
