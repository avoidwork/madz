## Why

madz's GitHub Copilot provider fails to connect on enterprise/GHE deployments. The enterprise base URL is derived incorrectly (`https://<domain>/api/v1` instead of `https://copilot-api.<domain>`), the provider does not discover the tenant's available models, and the token-exchange step (`copilot_internal/v2/token`) is unsupported on enterprise and currently throws, breaking the whole request path.

## What Changes

- Fix `base()` in `src/provider/copilotAuth.js` to return `https://copilot-api.<domain>` for enterprise (matching opencode), instead of `https://<domain>/api/v1`. The public default (`https://api.githubcopilot.com`) is unchanged.
- Add Copilot model discovery in `src/provider/openai.js`: when the provider is `github-copilot`, fetch `GET {base}/models` and resolve the configured `model` against the tenant's model list (filtering by `model_picker_enabled`). Fall back to the configured string if discovery fails.
- Make token exchange degrade gracefully in `src/provider/copilotAuth.js`: if `copilot_internal/v2/token` returns 404/unsupported on enterprise, fall back to sending the OAuth token directly as a bearer (opencode's approach) rather than failing. Genuine auth failures (401/403) still throw.
- Add/extend unit tests in `tests/unit/provider/copilotAuth.test.js` for `base()` (public + enterprise) and a regression test mocking a 404 on the token-exchange endpoint.

## Capabilities

### New Capabilities
<!-- None introduced -->

### Modified Capabilities
- `github-copilot-provider`: The enterprise base URL derivation changes to `https://copilot-api.<domain>`, and the provider discovers the tenant's available models via `GET {base}/models` when the provider is `github-copilot`.
- `copilot-token-exchange`: The token-exchange step falls back to sending the OAuth token directly as a bearer when `copilot_internal/v2/token` returns 404/unsupported on enterprise, instead of throwing.

## Impact

- `src/provider/copilotAuth.js` — `base()`, `exchangeCopilotToken()`, `createCopilotFetch()`.
- `src/provider/openai.js` — `createChatModel()` (enterprise base URL + model discovery).
- `tests/unit/provider/copilotAuth.test.js` — new/updated tests.
- `tests/unit/provider/openai.test.js` — updated enterprise base URL assertion.
