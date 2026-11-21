# Design

## Context

See proposal.md - Why. The resolver `getModelContextLength` in `src/provider/modelInfo.js` currently probes two candidates: the OpenAI-compatible `/models` endpoint and Ollama's `/api/show`. LiteLLM proxies serve an OpenAI-compatible `/v1/models` that returns only `{id, object, created, owned_by}` and do not implement Ollama's `/api/show`, so neither candidate yields a context length and the resolver returns `undefined`, falling back to the configured `contextWindow`.

## Goals / Non-Goals

**Goals:**
- Add a third probe candidate for LiteLLM's non-standard `/model/info` endpoint.
- Return the model's `max_input_tokens` (falling back to `max_output_tokens`) as the usable prompt budget.
- Reuse the existing auth (`sendKey`/`isInsecureRemote`) and `positive()` helpers.

**Non-Goals:**
- Not introducing a dedicated `litellm` provider `type`; LiteLLM proxies are configured as `type: openai` and detected by probing, consistent with the existing Ollama/vLLM approach.
- Not changing the configured `contextWindow` fallback behavior for unresolvable providers.

## Decisions

- **Probe `/model/info` as a third candidate.** LiteLLM exposes context limits only via `/model/info`; the standard `/v1/models` returns minimal fields. Adding a probe after the existing two keeps the resolver's "try each candidate, use whichever succeeds" contract intact and requires no `type` branching.
- **Construct the URL with a `buildModelInfoUrl` helper.** Mirror `buildModelsUrl`: strip trailing slashes and append `/model/info` to the base host (LiteLLM's route is relative to the base, not the `/v1` prefix). This keeps URL construction testable in isolation.
- **Read `max_input_tokens`, falling back to `max_output_tokens`.** `max_input_tokens` is the usable prompt budget; `max_output_tokens` is a secondary fallback when the input budget is absent. Both are read from the model entry's `model_info` object.
- **Match the model by `model_name` (or `model_info.model_name`).** LiteLLM's `/model/info` entries are keyed by the public model name; the resolver matches the configured `model` against the entry's `model_name` field, falling back to `model_info.model_name`.
- **Reuse `sendKey`/`isInsecureRemote`.** The `/model/info` endpoint requires the same API key as other proxy routes; the key is only sent over HTTPS to non-local hosts, consistent with the existing probes.

**Alternatives considered:**
- *Branch on a new `litellm` type* — rejected: it would require a config schema change and diverge from the existing probe-based detection for OpenAI-compatible providers.
- *Parse `max_output_tokens` as primary* — rejected: the usable prompt budget is `max_input_tokens`.

## Risks / Trade-offs

- [LiteLLM `/model/info` response shape varies across versions] → The resolver reads both `model_name` and `model_info.model_name`, and falls back to `max_output_tokens` when `max_input_tokens` is absent; on any failure it returns `undefined` and the configured `contextWindow` fallback still applies.
- [The `/model/info` probe adds a third network call at init] → It only runs after the first two candidates fail, and shares the existing 5s `PROBE_TIMEOUT_MS`; failure is non-fatal.
