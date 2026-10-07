## Context

madz's Copilot provider (`src/provider/copilotAuth.js` + `src/provider/openai.js`) currently targets the wrong API host for enterprise/GHE deployments. The `base()` function returns `https://<domain>/api/v1` for an enterprise URL, but GitHub's enterprise Copilot API lives at `https://copilot-api.<domain>`. Additionally, the provider does not discover the tenant's available models, so a configured model name may not match what the enterprise tenant actually exposes. Finally, the token-exchange step (`copilot_internal/v2/token`) is not supported on enterprise and currently throws, which breaks the entire request path.

The reference implementation is opencode, which is the source of truth for enterprise Copilot behavior:
- `base()`: `enterpriseUrl ? "https://copilot-api." + normalizeDomain(enterpriseUrl) : "https://api.githubcopilot.com"`
- Sends the OAuth access token directly as `Authorization: Bearer <refresh>` — it does NOT call `copilot_internal/v2/token`.
- Fetches `GET {base}/models` and filters by `model_picker_enabled`.

## Goals / Non-Goals

**Goals:**
- Fix the enterprise base URL to `https://copilot-api.<domain>`.
- Add Copilot model discovery via `GET {base}/models`, resolving the configured model against the tenant's model list.
- Make token exchange degrade gracefully on enterprise: fall back to sending the OAuth token directly as a bearer when `copilot_internal/v2/token` returns 404/unsupported.
- Add unit tests covering `base()` for public + enterprise domains and a regression test mocking a 404 on the token-exchange endpoint.

**Non-Goals:**
- No changes to the public (non-enterprise) Copilot flow beyond what is required.
- No changes to the OAuth device-flow authorization itself.
- No changes to the `model-context-length` resolver beyond what is needed for Copilot model discovery (the issue notes it "may need" Copilot `/models` handling, but the core fix is in `openai.js`).

## Decisions

**Decision 1: Enterprise base URL is `https://copilot-api.<domain>`.**
The current `https://<domain>/api/v1` is wrong for enterprise. opencode uses `https://copilot-api.<domain>`. We mirror opencode exactly. The public default remains `https://api.githubcopilot.com`.

**Decision 2: Model discovery lives in `createChatModel()` in `openai.js`.**
When `config.type === "github-copilot"`, after computing the base URL, fetch `GET {base}/models` and resolve the configured `model` against the tenant's model list. Filter by `model_picker_enabled` (opencode's approach). If discovery fails (network error, non-200, model not found), fall back to the configured string. This is a best-effort enhancement — it must never break model construction.

**Decision 3: Token exchange degrades gracefully on 404/unsupported.**
In `exchangeCopilotToken()`, if `copilot_internal/v2/token` returns 404 (or otherwise indicates the endpoint is unsupported on enterprise), fall back to returning the OAuth token itself as the bearer, with a synthetic expiry. Genuine auth failures (401/403) still throw. This mirrors opencode, which sends the OAuth token directly as a bearer and never calls the exchange endpoint.

**Decision 4: `createCopilotFetch()` uses the fallback bearer.**
When the exchange returns the OAuth token directly (fallback path), the interceptor sends `Authorization: Bearer <oauthToken>`. The `rewriteBaseUrl` logic is unchanged — it still honors `endpoints.api` when present, otherwise leaves the URL as-is.

## Risks / Trade-offs

- [Model discovery adds a network call at model-construction time] → It is best-effort and wrapped in try/catch; any failure falls back to the configured string, so it never blocks construction.
- [Sending the OAuth token directly as a bearer on enterprise] → This is opencode's documented approach and is the only way to authenticate against enterprise Copilot. The token is only sent to the enterprise Copilot API host, not to arbitrary endpoints.
- [The fallback could mask a genuine 404 misconfiguration] → The 404 fallback is scoped to the token-exchange endpoint only; other failures still throw, so genuine auth errors surface.
