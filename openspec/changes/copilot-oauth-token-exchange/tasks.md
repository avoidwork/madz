## 1. Exchange Function

- [ ] 1.1 Add `exchangeCopilotToken(oauthToken, opts)` to `src/provider/copilotAuth.js` that calls `GET https://api.githubcopilot.com/copilot_internal/v2/token` with `Authorization: token <oauthToken>` and returns the short-lived bearer plus `expires_at`
- [ ] 1.2 Add an in-memory cache keyed by the OAuth token storing the exchanged bearer and its expiry, re-exchanging on expiry

## 2. Interceptor Update

- [ ] 2.1 Update `createCopilotFetch` to exchange the OAuth token for a short-lived bearer and set `Authorization: Bearer <short-lived-token>` (not the raw OAuth token)
- [ ] 2.2 On 401, clear the cache and re-exchange, or invoke the re-auth handler if the exchange fails
- [ ] 2.3 Honor `endpoints.api` from the exchange response as the base URL for API requests, falling back to `base()`

## 3. Client ID

- [ ] 3.1 Switch `CLIENT_ID` in `src/provider/copilotAuth.js` from `Ov23liRuYfjAgknNjVBa` to `Iv1.b507a08c87ecfe98`

## 4. Tests

- [ ] 4.1 Update `tests/unit/provider/copilotAuth.test.js` to assert the exchanged bearer is sent (not the raw OAuth token)
- [ ] 4.2 Add tests for `exchangeCopilotToken` (success, expiry, failure)
