# Proposal

## Why

The model context-length resolver (`getModelContextLength` in `src/provider/modelInfo.js`) cannot discover a LiteLLM proxy's context window. LiteLLM exposes `max_input_tokens` only through the non-standard `/model/info` endpoint, not the OpenAI-compatible `/v1/models` endpoint (which returns only `{id, object, created, owned_by}`). As a result, discovery fails and the app silently falls back to the configured `contextWindow` default (128000), causing the status bar and summarization middleware to use an inaccurate window.

## What Changes

- Add a third probe candidate to `getModelContextLength` for LiteLLM's `/model/info` endpoint, after the existing OpenAI-compatible models and Ollama `/api/show` probes.
- Add a `buildModelInfoUrl` helper that constructs `{base}/model/info` from `base_url`, mirroring `buildModelsUrl`.
- Parse the `/model/info` response (an array of model entries) to find the entry matching the configured model and read `max_input_tokens` (falling back to `max_output_tokens`) from its `model_info` object.
- Reuse the existing `sendKey`/`isInsecureRemote` auth logic so the API key is only sent over HTTPS to non-local hosts.
- Add unit tests covering the LiteLLM `/model/info` shape, the `max_output_tokens` fallback, and the no-context-field case.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `model-context-length`: add a requirement that the resolver probes LiteLLM's `/model/info` endpoint and returns `max_input_tokens` (or `max_output_tokens`) when the OpenAI-compatible and Ollama candidates yield no usable context length.

## Impact

- `src/provider/modelInfo.js` — add the `/model/info` probe and `buildModelInfoUrl` helper.
- `tests/unit/provider/modelInfo.test.js` — add LiteLLM `/model/info` test cases.
- No new dependencies. No breaking changes.

## Non-goals

- Not changing how the configured `contextWindow` fallback works for providers that still cannot be resolved.
- Not adding a dedicated `litellm` provider `type`; LiteLLM proxies are configured as `type: openai` and are detected by probing, consistent with the existing Ollama/vLLM approach.
- Not handling LiteLLM's `max_output_tokens` as the primary value — `max_input_tokens` is the usable prompt budget.
