## Why

GitHub Copilot signals rate limiting with HTTP 403, not 429. The OpenAI SDK's `shouldRetry` only retries on 408/409/429/>=500, so Copilot 403 responses pass straight through even when `maxRetries` is configured. Users on the Copilot provider hit frequent 403 errors that could be retried transparently.

## What Changes

- Add a `CopilotRetry` middleware (`src/provider/copilotRetryMiddleware.js`) that retries 403 responses for Copilot connections.
- Wire it into the `createDeepAgent` middleware chain, gated to `providerConfig.type === "github-copilot"`, with `maxRetries: 3`.
- Honor the `retry-after` header for the delay, defaulting to 5s when absent.
- Add `-u AGENT_DECISION_BASE_URL` to the `test` and `coverage` scripts so the decision-tool test passes when that env var is set in the environment.

## Capabilities

### New Capabilities
- `copilot-403-retry`: Retrying GitHub Copilot 403 rate-limit responses via a `wrapModelCall` middleware, gated to Copilot connections only.

### Modified Capabilities
- `github-copilot-provider`: The provider's rate-limit handling changes to retry 403 responses (which Copilot uses for rate limiting) in addition to the SDK's built-in 429/5xx retries.

## Impact

- `src/provider/copilotRetryMiddleware.js` — new middleware.
- `src/agent/deepAgents.js` — register the middleware for `github-copilot` providers.
- `package.json` — add `-u AGENT_DECISION_BASE_URL` to test/coverage scripts.
- `tests/unit/provider/copilotRetryMiddleware.test.js` — new tests.

## Non-goals

- No changes to the OpenAI SDK's own retry behavior for non-Copilot providers.
- No changes to the token-budget middleware or its 429 handling.
- No new config schema fields; the retry count is fixed at 3.
