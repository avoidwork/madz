# Spec Delta

## MODIFIED Requirements

### Requirement: Resolver probes all candidate endpoints
The system SHALL provide `getModelContextLength(providerConfig)` that probes all candidate endpoints to determine the model's context window length, using whichever one succeeds. It SHALL NOT branch on the provider `type` field, because Ollama and vLLM both expose OpenAI-compatible APIs and are configured as `type: openai`. The one that succeeds determines the provider. The resolver SHALL also understand Copilot's `/models` response shape, reading the usable prompt budget (`max_prompt`, not `context_window`). For a LiteLLM proxy, which serves an OpenAI-compatible `/models` endpoint that returns only minimal fields (`{id, object, created, owned_by}`) and does not implement Ollama's `/api/show`, the resolver SHALL probe LiteLLM's non-standard `/model/info` endpoint and return the model's `max_input_tokens` (falling back to `max_output_tokens`) from its `model_info` object. For an `azure-openai` provider, which has no OpenAI-compatible `/models` endpoint, the resolver SHALL fall back to the configured `contextWindow` rather than probing. For a `bedrock` provider, which also has no OpenAI-compatible `/models` endpoint, the resolver SHALL fall back to the configured `contextWindow` rather than probing.

#### Scenario: vLLM endpoint returns max_model_len
- **WHEN** `GET {base_url}/models` (with the `/v1` dedup logic above) returns a list containing an entry whose `id` matches the configured model and that entry has `max_model_len`
- **THEN** the resolver returns `max_model_len`

#### Scenario: Ollama native endpoint returns context_length
- **WHEN** the OpenAI-compatible models endpoint yields no usable context length and `POST {base_url}/api/show` returns a response with `model_info.<family>.context_length`
- **THEN** the resolver returns `model_info.<family>.context_length`

#### Scenario: Ollama native endpoint returns num_ctx in parameters
- **WHEN** `POST {base_url}/api/show` returns a response without `model_info.<family>.context_length` but with `num_ctx` in the `parameters` string
- **THEN** the resolver parses and returns `num_ctx`

#### Scenario: Copilot endpoint returns limits.max_prompt
- **WHEN** the OpenAI-compatible models endpoint returns an entry for the configured model with a `limits` object containing a numeric `max_prompt`
- **THEN** the resolver returns `limits.max_prompt` as the usable prompt budget

#### Scenario: Copilot endpoint returns limits.context_window without max_prompt
- **WHEN** the OpenAI-compatible models endpoint returns an entry for the configured model with a `limits` object containing a numeric `context_window` but no `max_prompt`
- **THEN** the resolver returns `limits.context_window`

#### Scenario: Copilot endpoint returns opencode max_prompt_tokens
- **WHEN** the OpenAI-compatible models endpoint returns an entry for the configured model with a numeric top-level `max_prompt_tokens`
- **THEN** the resolver returns `max_prompt_tokens` as the usable prompt budget

#### Scenario: Copilot endpoint returns opencode max_context_window_tokens without max_prompt_tokens
- **WHEN** the OpenAI-compatible models endpoint returns an entry for the configured model with a numeric top-level `max_context_window_tokens` but no `max_prompt_tokens`
- **THEN** the resolver returns `max_context_window_tokens`

#### Scenario: LiteLLM endpoint returns max_input_tokens
- **WHEN** the OpenAI-compatible models endpoint and the Ollama `/api/show` endpoint both yield no usable context length and `GET {base}/model/info` returns a list containing an entry whose `model_name` (or `model_info.model_name`) matches the configured model and that entry has `max_input_tokens`
- **THEN** the resolver returns `max_input_tokens` as the usable prompt budget

#### Scenario: LiteLLM endpoint returns max_output_tokens without max_input_tokens
- **WHEN** the OpenAI-compatible models endpoint and the Ollama `/api/show` endpoint both yield no usable context length and `GET {base}/model/info` returns an entry for the configured model with `max_output_tokens` but no `max_input_tokens`
- **THEN** the resolver returns `max_output_tokens`

#### Scenario: LiteLLM endpoint has no usable context fields
- **WHEN** `GET {base}/model/info` returns an entry for the configured model with neither `max_input_tokens` nor `max_output_tokens`
- **THEN** the resolver falls through and ultimately returns `undefined`

#### Scenario: Copilot endpoint has no usable context fields
- **WHEN** the OpenAI-compatible models endpoint returns an entry for the configured model with neither `limits.max_prompt`/`limits.context_window` nor `max_prompt_tokens`/`max_context_window_tokens`
- **THEN** the resolver falls through to the next candidate and ultimately returns `undefined`

#### Scenario: Azure provider falls back to configured contextWindow
- **WHEN** `getModelContextLength` is called with an `azure-openai` provider config
- **THEN** the resolver returns the configured `contextWindow` without probing a `/models` endpoint

#### Scenario: Bedrock provider falls back to configured contextWindow
- **WHEN** `getModelContextLength` is called with a `bedrock` provider config
- **THEN** the resolver returns the configured `contextWindow` without probing a `/models` endpoint
