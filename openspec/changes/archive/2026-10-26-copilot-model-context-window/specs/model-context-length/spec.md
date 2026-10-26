## MODIFIED Requirements

### Requirement: Resolver probes all candidate endpoints
The system SHALL provide `getModelContextLength(providerConfig)` that probes all candidate endpoints to determine the model's context window length, using whichever one succeeds. It SHALL NOT branch on the provider `type` field, because Ollama and vLLM both expose OpenAI-compatible APIs and are configured as `type: openai`. The one that succeeds determines the provider. The resolver SHALL also understand Copilot's `/models` response shape, reading the usable prompt budget (`max_prompt`, not `context_window`).

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

#### Scenario: Copilot endpoint has no usable context fields
- **WHEN** the OpenAI-compatible models endpoint returns an entry for the configured model with neither `limits.max_prompt`/`limits.context_window` nor `max_prompt_tokens`/`max_context_window_tokens`
- **THEN** the resolver falls through to the next candidate and ultimately returns `undefined`
