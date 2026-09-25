# Copilot as an LLM Provider — Design Plan (Draft)

> **Status:** Rough plan — iterate here before any implementation.
> **Goal:** Add GitHub Copilot as an LLM provider for madz, with a hosted auth service so users never create their own GitHub App.

---

## 1. The problem

Copilot's API is OpenAI-compatible (`api.githubcopilot.com/v1/chat/completions`), so the model client is nearly free. The hard part is **auth**: Copilot uses OAuth device flow, and users shouldn't have to create their own GitHub App / client ID. So we need a hosted service that owns the OAuth flow and token refresh.

## 2. Architecture

Three components:

```
┌─────────────┐   device flow / refresh    ┌──────────────────┐   OAuth    ┌────────────┐
│  madz client │ ─────────────────────────▶ │  madz auth service │ ────────▶ │   GitHub    │
│  (local)     │ ◀───────────────────────── │  (hosted)          │ ◀──────── │  (OAuth)    │
└──────┬──────┘                            └──────────────────┘            └────────────┘
       │  chat completions (Bearer <ghu_ token>)
       ▼
┌────────────────────────────────────────────┐
│  api.githubcopilot.com/v1/chat/completions  │
└────────────────────────────────────────────┘
```

**Key decision: broker, not proxy.** The service brokers tokens, it does not proxy traffic. The client talks to Copilot directly with a short-lived access token. The service only ever sees auth flows — never prompts or responses. A proxy would be simpler (client points `base_url` at the service) but routes every prompt through us. Reject proxy on privacy grounds.

## 3. Auth flow (device flow)

The service owns the GitHub App (`client_id` + `client_secret`). The client never sees them.

1. **Client** → Service: `POST /v1/device` — "start login"
2. **Service** → GitHub: `POST /login/device/code` with its `client_id`
3. **GitHub** → Service: `device_code`, `user_code`, `verification_uri`, `expires_in`, `interval`
4. **Service** → Client: `{ user_code, verification_uri, device_code }`
5. **User** opens `verification_uri`, enters `user_code`, authorizes in browser
6. **Client** → Service: `POST /v1/device/poll` with `device_code`
7. **Service** → GitHub: `POST /login/oauth/access_token` (device_code + client_id + client_secret)
8. **GitHub** → Service: `access_token` (`ghu_...`), `refresh_token`, `expires_in`
9. **Service** stores `refresh_token` (encrypted), issues an opaque `session_token` to the client
10. **Service** → Client: `{ session_token, access_token, expires_in }`

The client stores `session_token` + `access_token` + `expires_at` locally. The service holds the `refresh_token` keyed by `session_token`.

## 4. Token lifecycle

- **Access token** (`ghu_...`): short-lived (hours). Client uses it directly against Copilot.
- **Refresh token**: long-lived. Held by the service, never sent to the client.
- **Refresh**: client calls `POST /v1/refresh` with `session_token` when the access token is within a buffer (say 5 min) of expiry. Service exchanges the stored refresh token for a new access token, returns it. Client updates `expires_at`.

Lazy refresh on request is the simplest correct model — `getAccessToken()` checks `expires_at`, refreshes if within the buffer. A proactive timer is a nice-to-have, not required, since the service owns the refresh cadence.

## 5. madz integration

### Config (`src/config/schemas/providers.js`)

`ProvidersSchema` is already passthrough, so a `copilot` key is accepted today. A proper schema gives validation + env mapping for free. The existing `DROPPED_KEYS` in `loader.js` already maps `providers.copilot.auth.serviceUrl` → `COPILOT_AUTH_SERVICE_URL` automatically.

```yaml
providers:
  copilot:
    type: copilot
    base_url: https://api.githubcopilot.com/v1
    model: gpt-4o
    auth:
      service_url: https://auth.madz.dev
    temperature: 0.4
    maxTokens: 4096
    rateLimit:
      requestsPerMinute: 60
      maxRetries: 6
      maxConcurrency: 4
      maxTokensMinute: 0
```

No `credentials.apiKey` — the token comes from the service.

### Provider factory (`src/provider/`)

`createChatModel` is OpenAI-specific. Add `src/provider/copilot.js` exporting `createCopilotModel`, or branch `createChatModel` on `type`. The key piece is **token injection via a custom `fetch`** in the OpenAI client config:

```js
const model = new ChatOpenAI({
  model: config.model,
  configuration: {
    baseURL: config.base_url,
    fetch: async (url, init) => {
      const token = await getAccessToken(); // refreshes if near expiry
      init.headers = {
        ...init.headers,
        Authorization: `Bearer ${token}`,
        // possibly Copilot-Integration-Id, etc. — see verification points
      };
      return fetch(url, init);
    },
  },
});
```

The fetch closure reads the current token on every call, so refresh is transparent. **This is the exact seam where the `bindTools` orphan lesson applies** — a constructor-config `fetch` should survive `bindTools()` (it's part of the config, not an instance-property patch), but we must verify empirically before shipping. That's a hard gate.

### Token manager (`src/provider/copilotAuth.js`)

`login()`, `getAccessToken()`, `refresh()`, `logout()`. Persists `session_token` + `access_token` + `expires_at` to a file with `0600` perms (e.g. `memory/tools/copilot.json`).

### TUI

`/copilot-login` (shows `user_code` + `verification_uri`, polls until authorized), `/copilot-status`, `/copilot-logout`.

## 6. The service

Separate repo (e.g. `madz-auth` / `copilot-broker`), open-source and self-hostable, with a hosted default.

### MVP endpoints

- `POST /v1/device` — initiate device flow
- `POST /v1/device/poll` — poll for authorization, return token + `session_token`
- `POST /v1/refresh` — exchange `session_token` for a fresh access token
- `POST /v1/revoke` — revoke a session (logout)

### Storage

SQLite for MVP (session → encrypted refresh_token, user_id, created_at, last_refresh). Postgres when it scales.

### Security

- `client_secret` never leaves the service, never in logs.
- Refresh tokens encrypted at rest.
- HTTPS only; no token logging.
- Per-session rate limiting on the auth endpoints.
- The service is a high-value target (it can mint access tokens) — treat it accordingly.

### Abuse consideration

Because the client talks to Copilot directly with its own token, each user's usage is attributed to their own GitHub account. That's the right model for Copilot's abuse detection. The service only does auth, so it won't trip Copilot's scripted-usage detection. The existing `requestsPerMinute` / `maxTokensMinute` in madz still govern the actual chat traffic.

## 7. Edge cases

- **Token expires mid-request** → the fetch refreshes before the call; a 401 on a stale token should trigger one refresh-and-retry.
- **Refresh fails** (revoked/expired refresh token) → surface a clear "re-authenticate" state, don't silently fall back.
- **Multiple devices** → each device does its own device flow, gets its own `session_token`. Service stores multiple sessions per user.
- **Logout** → client clears local token, calls `/v1/revoke`, service deletes the refresh token.
- **Service down** → Copilot auth is unavailable. madz should degrade gracefully (clear error, not a hang). This is the cost of a hosted dependency — worth stating plainly.

## 8. Verification points (must confirm before building)

1. **Does the Copilot chat completions endpoint accept an OAuth `ghu_` token from an arbitrary GitHub App?** I believe yes (the Copilot CLI uses a device-flow token), but this is the load-bearing assumption. If it only accepts tokens from the official Copilot app, the whole design changes.
2. **Does the custom `fetch` survive `bindTools()`?** Given the orphan-patch lesson, this needs a runtime probe, not an inference.
3. **What headers does the endpoint require?** I recall a `Copilot-Integration-Id` (or similar) header may be needed. The fetch can inject it.
4. **Access token TTL** — the service must honor GitHub's `expires_in`, not assume a fixed value.

## 9. Open decisions

1. **Broker vs. proxy** — recommending broker (privacy). Confirm.
2. **Service repo** — separate repo, open-source + self-hostable, hosted default. Confirm.
3. **Model exposure** — expose Copilot's model list as-is, or curate a subset? (Affects the config `model` field and any model-picker UX.)
4. **Scope for MVP** — device flow + refresh only, or also multi-device session linking and org/enterprise installation tokens? Cut org/enterprise for now and ship individual-subscription device flow first.
