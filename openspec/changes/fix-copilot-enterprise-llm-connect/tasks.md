## 1. Fix Enterprise Base URL

- [ ] 1.1 Update `base()` in `src/provider/copilotAuth.js` to return `https://copilot-api.<domain>` for enterprise (matching opencode), instead of `https://<domain>/api/v1`. The public default (`https://api.githubcopilot.com`) is unchanged.
- [ ] 1.2 Update the `enterpriseUrl` handling in `src/provider/openai.js` `createChatModel()` so the client `baseURL` uses the corrected `base(config.enterpriseUrl)`.

## 2. Add Copilot Model Discovery

- [ ] 2.1 In `src/provider/openai.js`, when the provider is `github-copilot`, fetch `GET {base}/models` and resolve the configured `model` against the tenant's model list (filtering by `model_picker_enabled`).
- [ ] 2.2 Fall back to the configured model string if discovery fails (network error, non-200, model not found).

## 3. Graceful Token Exchange Fallback

- [ ] 3.1 In `src/provider/copilotAuth.js` `exchangeCopilotToken()`, if `copilot_internal/v2/token` returns 404/unsupported on enterprise, fall back to sending the OAuth token directly as a bearer (opencode's approach) rather than failing.
- [ ] 3.2 Ensure genuine auth failures (401/403) still throw.

## 4. Add Unit Tests

- [ ] 4.1 Add/extend `tests/unit/provider/copilotAuth.test.js` covering `base()` for public and enterprise domains, asserting the `copilot-api.<domain>` host.
- [ ] 4.2 Add a regression test mocking a 404 on the token-exchange endpoint.
- [ ] 4.3 Update `tests/unit/provider/openai.test.js` enterprise base URL assertion to `https://copilot-api.<domain>`.

## 5. Verify

- [ ] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions.
