## Context

The GitHub Copilot provider in madz authenticates via the OAuth 2.0 Device Authorization Grant (RFC 8628). The device flow produces an OAuth access token (a `ghu_` token) that is persisted to `memory/auth.json`. `createCopilotFetch` in `src/provider/copilotAuth.js` reads that token and injects it directly as `Authorization: Bearer <token>` on every request.

The Copilot API does not accept the raw OAuth token. It requires a short-lived, HMAC-signed bearer token obtained by exchanging the OAuth token at `https://api.githubcopilot.com/copilot_internal/v2/token`. This is the flow opencode uses. Additionally, the configured `CLIENT_ID` (`Ov23liRuYfjAgknNjVBa`, a GitHub App id) is not authorized for the exchange; the working flow uses the legacy VS Code OAuth App id `Iv1.b507a08c87ecfe98`.

The exchange must live in (or be called by) the fetch interceptor, because `createChatModel` in `src/provider/openai.js` wires `opts.configuration.fetch = createCopilotFetch()` for `type === "github-copilot"`, and the interceptor is the single point where the Authorization header is set.

## Goals / Non-Goals

**Goals:**
- Exchange the OAuth device-flow token for a short-lived API bearer at `copilot_internal/v2/token`.
- Cache the exchanged bearer in memory, keyed by the OAuth token, re-exchanging on expiry.
- Update `createCopilotFetch` to send the exchanged bearer, not the raw OAuth token.
- Switch `CLIENT_ID` to the legacy VS Code OAuth App id so the device-flow token is authorized for the exchange.
- Honor `endpoints.api` from the exchange response as the base URL for API requests.

**Non-Goals:**
- No changes to the device-flow or polling logic.
- No persistence of the short-lived bearer to disk.
- No changes to other providers.

## Decisions

### Decision 1: Exchange lazily inside the fetch interceptor
The exchange is performed lazily inside `createCopilotFetch` on each request, using a cache keyed by the OAuth token. This keeps the interceptor self-contained and survives `bindTools()` without rebuilding the model. Alternative (rejected): exchanging at model-construction time would not pick up a re-auth without rebuilding the model.

### Decision 2: In-memory cache keyed by the OAuth token
A module-level `Map` caches `{ token, expiresAt, endpoints }` keyed by the OAuth token. On each request, if a cached entry exists and is not expired, it is reused; otherwise the exchange is re-run. This avoids re-requesting on every call while keeping the short-lived bearer fresh. Alternative (rejected): persisting the bearer to disk would leak a credential and complicate expiry handling.

### Decision 3: On 401, clear the cache and re-exchange once
When a request returns 401, the interceptor clears the cached entry and re-exchanges once. If the re-exchange fails, it invokes the registered `authRequiredHandler` so the user can re-authenticate. The 401 response is returned unchanged so the caller's error handling still fires.

### Decision 4: Honor `endpoints.api`
The exchange response includes an `endpoints` object with an `api` field (relevant for Business/Enterprise plans). When present, the interceptor rewrites the request URL to use `endpoints.api` as the origin, falling back to `base()`.

## Risks / Trade-offs

- [Exchange endpoint availability] → The exchange endpoint may be unavailable or rate-limited. The interceptor surfaces the error and invokes the re-auth handler on failure.
- [Cache staleness] → A cached bearer could expire between requests. Expiry is checked on each request and the cache is re-exchanged when expired.
- [401 loop] → A persistent 401 could cause repeated re-exchanges. The interceptor re-exchanges at most once per request and falls back to the re-auth handler.
