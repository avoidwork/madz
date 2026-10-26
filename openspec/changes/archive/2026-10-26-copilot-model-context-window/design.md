## Context

madz's GitHub Copilot integration resolves the model context window via `getModelContextLength` (src/provider/modelInfo.js) and the effective model name via `resolveCopilotModel` (src/provider/openai.js). Both probe Copilot's `/models` endpoint, but neither understands Copilot's response shape, and the discovery call is unauthenticated.

The resolver currently handles two shapes:
- vLLM: `max_model_len` on the OpenAI-compatible `/models` entry.
- Ollama: `context_length` / `num_ctx` from the native `/api/show` endpoint.

Copilot returns a third shape: `limits.context_window` / `limits.max_prompt` (or, per opencode, top-level `max_context_window_tokens` / `max_prompt_tokens` / `max_output_tokens`). The resolver returns `undefined` for Copilot, so `deepAgents.js` falls back to the configured 128000 default for both the summarization trigger and the provider `contextWindow`.

Separately, `resolveCopilotModel` fetches `{base}/models` with only `Accept: application/json` and no `Authorization: Bearer` header. Copilot's endpoint is authenticated, so it returns 401/403 and the function falls back to the configured model string.

## Goals / Non-Goals

**Goals:**
- Authenticate the `/models` discovery call with the Copilot bearer token, reusing the existing `createCopilotFetch` / `getToken` path so the token is read fresh from `memory/auth.json` and 401 re-auth is handled consistently.
- Teach `getModelContextLength` to read Copilot's usable prompt budget (`max_prompt`, not `context_window`).
- Preserve the never-throw contract: all failure paths return `undefined` or fall back gracefully.
- Add unit tests for both the `limits` object shape and the opencode `max_*_tokens` shape, plus the auth header assertion.

**Non-Goals:**
- No change to the TUI status-bar rendering; it consumes the resolved value.
- No change to other providers' resolution.
- No change to the Copilot token exchange or device-flow authorization.

## Decisions

### Decision 1: Reuse `createCopilotFetch` for the discovery call
`resolveCopilotModel` should decorate the `/models` request with the same fetch interceptor used for model calls. This reads the token fresh from `memory/auth.json` via `getToken`, sets the standard Copilot headers, and handles 401 re-auth by clearing the token and invoking the auth-required handler. This keeps the discovery path consistent with the model-call path and avoids duplicating token logic.

- **Alternative considered:** Calling `getToken()` directly and setting `Authorization: Bearer <token>` manually. Rejected because it duplicates the header/401 handling already in `createCopilotFetch` and would drift from the model-call path.

### Decision 2: Read `max_prompt`, not `context_window`, as the usable budget
Copilot reports `context_window` (e.g. 400K/1M) larger than the usable `max_prompt` (often 128K). The usable budget is `max_prompt`. The resolver prefers `limits.max_prompt` (or opencode's `max_prompt_tokens`), falling back to `limits.context_window` (or `max_context_window_tokens`) only when `max_prompt` is absent.

- **Alternative considered:** Using `context_window` directly. Rejected because it over-reports the usable budget, causing the summarization trigger and TUI context meter to exceed what the API actually accepts.

### Decision 3: Guard the new fields, preserve never-throw
The Copilot branch only returns a number when the field is present and numeric. Otherwise it falls through to the existing candidates and ultimately returns `undefined`. The resolver never throws.

## Risks / Trade-offs

- **[Token read from disk on every discovery call]** → `createCopilotFetch` reads the token fresh via `getToken`, which caches in module state (`copilotToken`). Subsequent calls reuse the cached token; only a 401 clears it. Acceptable.
- **[Copilot shape may vary across deployments]** → The resolver handles both the `limits` object shape and the opencode `max_*_tokens` shape, and falls back gracefully when neither is present.
- **[`context_window` over-reports]** → Mitigated by preferring `max_prompt` as the usable budget.
