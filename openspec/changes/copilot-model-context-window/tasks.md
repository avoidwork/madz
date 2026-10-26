## 1. Authenticate model discovery

- [ ] 1.1 In `resolveCopilotModel` (src/provider/openai.js), decorate the `/models` fetch with the Copilot bearer token by reusing `createCopilotFetch` from src/provider/copilotAuth.js, so the request carries `Authorization: Bearer <token>` and 401 re-auth is handled consistently.

## 2. Resolve Copilot context window

- [ ] 2.1 In `getModelContextLength` (src/provider/modelInfo.js), add a Copilot branch that reads the usable prompt budget from the `/models` response: prefer `limits.max_prompt` (or opencode's `max_prompt_tokens`), falling back to `limits.context_window` (or `max_context_window_tokens`) only when `max_prompt` is absent.
- [ ] 2.2 Guard the new fields: only return a number when the field is present and numeric; otherwise fall through to the existing candidates and ultimately return `undefined`. Preserve the never-throw contract.

## 3. Add unit tests

- [ ] 3.1 In `tests/unit/provider/modelInfo.test.js`, add cases for a Copilot-shaped `/models` response (both the `limits` object shape and the opencode `max_*_tokens` shape), asserting the resolver returns the usable prompt budget.
- [ ] 3.2 In `tests/unit/provider/openai.test.js`, add a case asserting `resolveCopilotModel` sends the `Authorization: Bearer` header on the `/models` request.

## 4. Verify

- [ ] 4.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions and that the new branches are covered.
