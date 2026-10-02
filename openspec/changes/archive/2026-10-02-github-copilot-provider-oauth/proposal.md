## Why

Madz currently supports only OpenAI-compatible providers that take a static `apiKey`. GitHub Copilot is a widely available, subscription-based LLM source that does not expose a static API key — it requires OAuth. The OAuth 2.0 Device Authorization Grant (RFC 8628) is the correct fit for an input-constrained CLI/TUI client that cannot host a redirect URI, and it works headless in the Docker/VM deployment where no public callback endpoint exists.

## What Changes

- Add a `github-copilot` provider type to the config schema, with `base_url` defaulting to `https://api.githubcopilot.com` and **no** `credentials.apiKey` requirement.
- Add `src/provider/copilotAuth.js` implementing the OAuth device flow: device-code request, polling loop (handling `authorization_pending` and `slow_down` per RFC 8628), token persistence to `memory/auth.json` (mode `0o600`), and a `createCopilotFetch()` interceptor that injects `Authorization: Bearer <token>`.
- Wire the fetch interceptor into `createChatModel()` so a Copilot-configured model reads the token fresh on every request.
- Add `madz auth login` / `auth status` / `auth logout` CLI commands.
- Add unit tests for the auth module.

## Capabilities

### New Capabilities
- `github-copilot-provider`: Configuration and runtime support for GitHub Copilot as an LLM provider, including the OAuth device-flow auth module, token persistence, and the bearer-token fetch interceptor.

### Modified Capabilities
- None. The existing `openai` provider path is unchanged; this is a new provider type.

## Impact

- **Code**: `src/config/schemas/providers.js`, `src/config/schemas/index.js`, `src/provider/copilotAuth.js` (new), `src/provider/openai.js`, `index.js`.
- **Tests**: `tests/unit/provider/copilotAuth.test.js` (new).
- **Config**: `config.yaml` may declare a `providers.github-copilot` block.
- **Dependencies**: None new — uses Node 24+ built-in `fetch`, `node:fs/promises`, `node:timers/promises`. `ChatOpenAI` (already a dependency) accepts a custom `configuration.fetch`.
- **Security**: Token at rest in `memory/auth.json` (mode `0o600`). No callback endpoint, so no CSRF/state surface.

## Non-goals

- Not implementing a web service or authorization-code flow with a public callback endpoint.
- Not supporting Copilot's `/models` discovery endpoint or model-capability mapping (out of scope for this change).
- Not adding a refresh-token grant — Copilot's device flow does not issue a refresh token; the refresh mechanism is a 401 re-run of the device flow.
