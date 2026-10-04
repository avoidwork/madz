## Why

The deepagents summarization trigger is a fixed token count in `config.yaml` (`summarization.trigger.type: tokens, value: 100000`). That value drifts from reality as models change: when the model's real context window is smaller than the configured trigger, the conversation overflows and the model errors with a 400 context-window error before summarization fires; when it's larger, we summarize too early and lose context we didn't need to. The provider already knows the model's true context length, so we should read it at startup and derive the trigger from it.

## What Changes

- Add a new module `src/provider/modelInfo.js` exporting `getModelContextLength(providerConfig)` that probes provider endpoints to determine the model's context window length.
- In `createDeepAgentsOrchestrator` (`src/agent/deepAgents.js`), after the model is created and before `createSummarizationMiddlewareFromConfig` is called, resolve the context length and compute `triggerTokens = Math.floor(contextLength * 0.8)`. Pass the resolved `{ type: "tokens", value: triggerTokens }` trigger to the middleware, overriding the configured token value.
- Fallback: if the context length cannot be resolved, fall back to the configured token value so startup never blocks on a network call.
- **No config schema change** — the 80% is hardcoded; `config.yaml` and `src/config/schemas/summarization.js` are left untouched.

## Capabilities

### New Capabilities
- `model-context-length`: A provider-aware resolver that probes all candidate endpoints (the OpenAI-compatible models endpoint for vLLM, `POST /api/show` for Ollama) to determine the model's context window length, returning `undefined` on any failure so the caller falls back gracefully. It does NOT branch on the provider `type` field, because Ollama and vLLM both expose OpenAI-compatible APIs and are configured as `type: openai`. It constructs the models URL from `base_url` without duplicating a `/v1` prefix — if `base_url` already ends with `/v1`, it appends `/models`; otherwise it appends `/v1/models`.

### Modified Capabilities
- `summarization-config`: The summarization trigger is now derived from the resolved model context length (80%) when available, overriding the configured token value. When the context length cannot be resolved, the configured value is used unchanged.

## Impact

- **New**: `src/provider/modelInfo.js` — exports `getModelContextLength(providerConfig)`.
- **Modified**: `src/agent/deepAgents.js` — resolve context length and compute the trigger override before `createSummarizationMiddlewareFromConfig`.
- **New**: `tests/unit/provider/modelInfo.test.js` — unit tests for the resolver (vLLM, Ollama, fallback).
- **Modified**: `tests/unit/deepAgents.test.js` — integration test asserting the middleware receives the computed token trigger.
- **Unchanged**: `src/provider/summarizationMiddleware.js`, `src/config/schemas/summarization.js`, `config.yaml`.

## Non-goals

- No config schema change. The 80% is hardcoded.
- No new npm packages.
- No change to the OpenAI static profile fallback path beyond what the resolver already handles.
