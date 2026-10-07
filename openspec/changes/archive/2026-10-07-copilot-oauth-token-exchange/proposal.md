## Why

The GitHub Copilot provider sends the raw OAuth device-flow token directly to the Copilot API as `Authorization: Bearer`, skipping the required exchange at `copilot_internal/v2/token`. The Copilot API rejects the raw token, so Copilot authentication never works. Additionally, the configured client id (`Ov23li...`, a GitHub App id) is not authorized for the exchange; the working flow uses the legacy VS Code OAuth App id `Iv1.b507a08c87ecfe98`.

## What Changes

- Add `exchangeCopilotToken(oauthToken, opts)` in `src/provider/copilotAuth.js` that calls `GET https://api.githubcopilot.com/copilot_internal/v2/token` with `Authorization: token <oauthToken>` and returns the short-lived bearer plus `expires_at`.
- Cache the exchanged bearer (and its expiry) in memory, keyed by the OAuth token, re-exchanging on expiry.
- Update `createCopilotFetch` to exchange the OAuth token for a short-lived bearer and set `Authorization: Bearer <short-lived-token>`. On 401, clear the cache and re-exchange (or invoke the re-auth handler if the exchange fails).
- Switch `CLIENT_ID` from `Ov23liRuYfjAgknNjVBa` to `Iv1.b507a08c87ecfe98`.
- Honor `endpoints.api` from the exchange response as the base URL for API requests (falls back to `base()`).

## Capabilities

### New Capabilities
- `copilot-token-exchange`: Exchanging the OAuth device-flow token for a short-lived API bearer, caching it, and honoring the `endpoints.api` base URL.

### Modified Capabilities
- `github-copilot-provider`: The bearer token injection requirement changes from sending the raw OAuth token to sending the exchanged short-lived bearer.

## Impact

- `src/provider/copilotAuth.js` — add `exchangeCopilotToken`, cache helpers, update `createCopilotFetch`, switch `CLIENT_ID`, honor `endpoints.api`.
- `src/provider/openai.js` — no change required; the interceptor already wires the fetch.
- `tests/unit/provider/copilotAuth.test.js` — update `createCopilotFetch` tests to assert the exchanged bearer, and add tests for `exchangeCopilotToken` (success, expiry, failure).

## Non-goals

- No changes to the device-flow or polling logic.
- No persistence of the short-lived bearer to disk.
- No changes to other providers.
