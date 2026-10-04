## Context

The deepagents summarization trigger is a fixed token count in `config.yaml` (`summarization.trigger.type: tokens, value: 100000`). That value drifts from reality as models change: when the model's real context window is smaller than the configured trigger, the conversation overflows and the model errors with a 400 context-window error before summarization fires; when it's larger, we summarize too early and lose context we didn't need to.

The provider already knows the model's true context length. For vLLM that's `max_model_len` on the `/v1/models` response; for Ollama it's the model's `context_length` (or `num_ctx`) from the native `/api/show` endpoint. We should read it at startup and derive the trigger from it, so compression always fires at the right point regardless of which model is loaded.

The init seam is `createDeepAgentsOrchestrator` in `src/agent/deepAgents.js`: the model is created via `createChatModel(providerConfig)` (line ~323), and `createSummarizationMiddlewareFromConfig({ backend, config: config.summarization })` is called at line ~417. The context-length fetch and trigger computation belong between these two points.

## Goals / Non-Goals

**Goals:**
- Add a provider-aware context-length resolver (`src/provider/modelInfo.js`) exporting `getModelContextLength(providerConfig)`.
- Derive the summarization trigger from the resolved context length (80%) at init, overriding the configured token value.
- Fall back to the configured token value when the context length cannot be resolved, so startup never blocks on a network call.
- No config schema change; the 80% is hardcoded.

**Non-Goals:**
- No config schema change (`config.yaml` and `src/config/schemas/summarization.js` are untouched).
- No new npm packages.
- No change to `src/provider/summarizationMiddleware.js` (it already passes `trigger`/`keep` through).
- No change to the OpenAI static profile fallback path beyond what the resolver already handles.

## Decisions

### Decision 1: Probe all endpoints instead of branching on provider `type`
**Choice**: `getModelContextLength(providerConfig)` probes ALL candidate endpoints and uses whichever one succeeds in returning a usable context length. The one that succeeds determines the provider.
**Rationale**: The issue's original proposal branched on the provider `type` field (e.g. `type: openai` vs `type: ollama`) to detect vLLM/Ollama. This is incorrect: Ollama and vLLM both expose OpenAI-compatible APIs and are configured as `type: openai` in the config. You cannot rely on the `type` field to distinguish them. Probing all endpoints is provider-agnostic and robust.
**Alternatives**: Branching on `type` — rejected because it misclassifies vLLM/Ollama as plain OpenAI.

### Decision 2: Probe order — `/v1/models` first, then `/api/show`
**Choice**: Probe `GET {base_url}/v1/models` first (OpenAI-compatible), then `POST {base_url}/api/show` (Ollama native).
**Rationale**: The OpenAI-compatible endpoint is the most common configuration surface. If the model entry has `max_model_len`, it's a vLLM endpoint and we return it. Otherwise, fall through to the Ollama native endpoint. This ordering handles the common case first and the Ollama-specific case second.
**Alternatives**: Probing `/api/show` first — rejected because it would fail for pure OpenAI/vLLM endpoints that don't expose the Ollama native API.

### Decision 3: Explicit token-int computation instead of the library's `fraction` trigger
**Choice**: Compute `triggerTokens = Math.floor(contextLength * 0.8)` and pass `{ type: "tokens", value: triggerTokens }`.
**Rationale**: `deepagents`' `createSummarizationMiddleware` supports `{ type: "fraction", value: 0.8 }` and computes `Math.floor(maxInputTokens * value)` internally, but it reads `maxInputTokens` from `resolvedModel.profile.maxInputTokens`, a static map in `@langchain/openai` that returns `{}` for vLLM/Ollama models. Computing the token int ourselves is provider-agnostic and matches the stated goal.
**Alternatives**: Using the `fraction` trigger — rejected because it would never fire for vLLM/Ollama models.

### Decision 4: Init-time resolution
**Choice**: Read the context length at startup rather than lazily on first overflow.
**Rationale**: Lazy resolution adds latency at the worst moment (when the window is already full). Init-time resolution ensures compression always fires at the right point regardless of which model is loaded.
**Alternatives**: Lazy resolution on first overflow — rejected.

### Decision 5: Defensive resolver, never throws
**Choice**: On any failure (unreachable, model not found, field absent, non-200), move on to the next candidate or return `undefined`. Never throw.
**Rationale**: The caller falls back gracefully to the configured token value. Startup must never block on a network call.
**Alternatives**: Throwing on failure — rejected because it would crash startup.

## Risks / Trade-offs

### Risk: Network call at init adds latency
The resolver makes up to two HTTP calls at startup.
**Mitigation**: The resolver is defensive and returns `undefined` on any failure, so startup never blocks. The calls are bounded and only made once at init.

### Risk: Model not found in `/v1/models` list
The configured model may not appear in the `/v1/models` response.
**Mitigation**: The resolver moves on to the next candidate (`/api/show`) or returns `undefined`, falling back to the configured token value.

### Risk: `max_model_len` absent on a vLLM endpoint
Some vLLM deployments may not expose `max_model_len`.
**Mitigation**: The resolver falls through to the Ollama native endpoint, then returns `undefined` if neither yields a context length.

### Risk: `model_info.<family>.context_length` absent or `num_ctx` not in `parameters`
The Ollama `/api/show` response may not contain a usable context length.
**Mitigation**: The resolver parses `num_ctx` from the `parameters` string as a fallback, then returns `undefined` if neither field is present.

### Risk: 100% coverage gate fails with new module
Adding `modelInfo.js` introduces new functions that must be tested to maintain coverage.
**Mitigation**: Tests are included as part of the task list (see tasks.md).
