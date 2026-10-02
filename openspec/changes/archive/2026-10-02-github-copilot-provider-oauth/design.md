## Context

Madz's provider layer (`src/provider/openai.js`) builds a `ChatOpenAI` model from a config block that requires `credentials.apiKey`. GitHub Copilot does not expose a static API key — it authenticates via OAuth. The existing `ProvidersSchema` is `z.object({}).passthrough()`, so a new provider key passes validation today, but `OpenaiProviderConfigSchema` requires `credentials.apiKey` (min 1), which a Copilot provider cannot satisfy.

The deployment target is a headless Docker/VM. There is no public callback endpoint, so an authorization-code flow with a redirect URI is not viable. The OAuth 2.0 Device Authorization Grant (RFC 8628) is designed exactly for this: the user opens a URL in their own browser, enters a code, and the client polls for the token.

## Goals / Non-Goals

**Goals:**
- Add a `github-copilot` provider type that validates without a static `apiKey`.
- Implement the OAuth device flow in a self-contained `src/provider/copilotAuth.js` module.
- Inject the bearer token on every model request via a custom `configuration.fetch`, read fresh from the auth file.
- Add `madz auth login` / `status` / `logout` CLI commands.
- Cover the auth module with unit tests.

**Non-Goals:**
- No web service or authorization-code flow with a public callback.
- No Copilot `/models` discovery or model-capability mapping.
- No refresh-token grant (Copilot's device flow does not issue one).

## Decisions

### Decision 1: Device flow over authorization-code flow
The device flow (RFC 8628) requires no redirect URI, no TLS callback, no `state`/CSRF, and no PKCE. It is the standard for input-constrained clients and works headless. An authorization-code flow would require a public HTTPS endpoint, TLS, and CSRF protection — a net security regression for a single-user, self-hosted tool.

### Decision 2: Custom `configuration.fetch` over monkey-patching
`ChatOpenAI.bindTools()` constructs a new model object via `withConfig()`, which orphans any `invoke`/`stream` instance-property overrides (a documented Madz lesson in `langchain_bindtools_orphan_patch`). A custom `configuration.fetch` is part of the model's configuration and survives `bindTools()`. It also reads the token fresh on every request, so a re-auth takes effect without rebuilding the model.

### Decision 3: Store the access token as the bearer, no refresh token
Copilot's device flow returns an access token, not a refresh token. opencode stores it as both `refresh` and `access`, sets `expires: 0`, and reuses it as a bearer on every request. Madz mirrors this: `getToken()` returns the stored token, and a 401 triggers a re-run of the device flow (the "refresh" mechanism).

### Decision 4: Token at rest in `memory/auth.json` with mode `0o600`
Consistent with the existing `memory/` directory layout (`sessionsDir`, `toolsDir`, etc.). Mode `0o600` restricts read/write to the owning user. The token is never logged and never committed.

### Decision 5: `CLIENT_ID` is a public OAuth client id, not a secret
The `Ov23li8tweQw6odWQebz` client id is public (same as opencode's). It is not a credential and can be committed.

## Risks / Trade-offs

- [Token at rest on a remote VM] → Mitigate with `0o600` and a dedicated volume; never commit the file. Anyone with VM access can read it — the user should treat the VM as trusted.
- [Token may expire or be revoked] → The `getToken()` read is fresh per request; a 401 triggers re-auth. No proactive refresh is attempted.
- [`slow_down` polling] → Handle per RFC 8628: add 5s to the interval, or honor a server-provided interval, plus a safety margin.
- [Enterprise/GHE URL normalization] → `normalizeDomain` strips scheme and trailing slash; validate the URL before use to avoid SSRF-style injection into the base URL.

## Migration Plan

1. Add the schema and export it.
2. Add `src/provider/copilotAuth.js`.
3. Wire the fetch interceptor into `createChatModel`.
4. Add CLI auth commands.
5. Add unit tests.
6. Verify with `npm run test`, `npm run lint`, `npm run coverage`.

Rollback: revert the provider config to `openai` in `config.yaml`; the `openai` path is unchanged.

## Open Questions

- Should the auth file path be derived from `memory.directory` or a new `memory.authFile` key? (Default: `memory/auth.json`.)
- Should `auth status` report the token's expiry, or just presence? (Copilot sets `expires: 0`, so presence is the practical signal.)
