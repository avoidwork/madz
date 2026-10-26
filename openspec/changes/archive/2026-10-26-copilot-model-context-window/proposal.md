## Why

madz's GitHub Copilot integration cannot resolve the real context window from Copilot's `/models` API. The context-length resolver probes for vLLM (`max_model_len`) and Ollama (`context_length`) shapes, but Copilot returns a different shape, so resolution silently falls back to the configured 128000 default — and the model-name resolver never sends an auth header, so it cannot even fetch the list.

## What Changes

- `resolveCopilotModel` (src/provider/openai.js) now decorates the `/models` discovery request with the Copilot bearer token, reusing `createCopilotFetch`/`getToken` from src/provider/copilotAuth.js so the token is read fresh from `memory/auth.json` and 401 re-auth is handled consistently with the model-call path.
- `getModelContextLength` (src/provider/modelInfo.js) now detects a Copilot-shaped `/models` response and reads the usable prompt budget. It prefers `limits.max_prompt` (or opencode's `max_prompt_tokens`), falling back to `limits.context_window` (or `max_context_window_tokens`) only when `max_prompt` is absent. The usable budget is `max_prompt`, not `context_window`.
- The new fields are guarded: a number is returned only when the field is present and numeric; otherwise the resolver falls through to the existing candidates and ultimately returns `undefined`, preserving the never-throw contract.
- Unit tests are added for the Copilot-shaped response (both the `limits` object shape and the opencode `max_*_tokens` shape) and for the `Authorization: Bearer` header on the `/models` request.

## Capabilities

### New Capabilities
_(none — this change modifies existing capabilities only)_

### Modified Capabilities
- `model-context-length`: the resolver now also understands Copilot's `/models` response shape (`limits.context_window` / `limits.max_prompt`, or opencode's `max_context_window_tokens` / `max_prompt_tokens`), returning the usable prompt budget.
- `github-copilot-provider`: the model discovery call (`GET {base}/models`) is now authenticated with the Copilot bearer token, so it can actually fetch the tenant model list.

## Impact

- `src/provider/openai.js` — `resolveCopilotModel` (line ~240), `createChatModel` (line ~119-123).
- `src/provider/modelInfo.js` — `getModelContextLength` (line ~73).
- `src/provider/copilotAuth.js` — `createCopilotFetch` / `getToken` (line ~449).
- `src/agent/deepAgents.js` — downstream consumer (line ~451-468) of the resolved context length.
- `tests/unit/provider/modelInfo.test.js`, `tests/unit/provider/openai.test.js`.

## Non-goals

- No change to the TUI status-bar rendering itself; it consumes the resolved value.
- No change to other providers' context-length resolution.
- No change to the Copilot token exchange or device-flow authorization.
