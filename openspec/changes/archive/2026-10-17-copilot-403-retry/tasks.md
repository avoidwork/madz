## 1. Middleware

- [x] 1.1 Add `src/provider/copilotRetryMiddleware.js` exporting `createCopilotRetryMiddleware` and `DEFAULT_COPILOT_RETRY_MS`
- [x] 1.2 Implement `wrapModelCall` to retry 403 responses up to `maxRetries` (3) after the initial attempt
- [x] 1.3 Honor the `retry-after` header for the delay, defaulting to 5s when absent

## 2. Orchestrator Wiring

- [x] 2.1 Import `createCopilotRetryMiddleware` in `src/agent/deepAgents.js`
- [x] 2.2 Register the middleware in the `createDeepAgent` middleware array, gated to `providerConfig.type === "github-copilot"` with `maxRetries: 3`

## 3. Test Env Fix

- [x] 3.1 Add `-u AGENT_DECISION_BASE_URL` to the `test` and `coverage` scripts in `package.json`

## 4. Tests

- [x] 4.1 Add `tests/unit/provider/copilotRetryMiddleware.test.js` covering success, retry-then-succeed, exhaust-all-retries, non-403 passthrough, 429 passthrough, and retry-after honoring
