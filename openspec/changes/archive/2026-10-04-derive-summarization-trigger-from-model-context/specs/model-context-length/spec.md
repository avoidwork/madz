## ADDED Requirements

### Requirement: Resolver probes all candidate endpoints
The system SHALL provide `getModelContextLength(providerConfig)` that probes all candidate endpoints to determine the model's context window length, using whichever one succeeds. It SHALL NOT branch on the provider `type` field, because Ollama and vLLM both expose OpenAI-compatible APIs and are configured as `type: openai`. The one that succeeds determines the provider.

#### Scenario: vLLM endpoint returns max_model_len
- **WHEN** `GET {base_url}/models` (with the `/v1` dedup logic above) returns a list containing an entry whose `id` matches the configured model and that entry has `max_model_len`
- **THEN** the resolver returns `max_model_len`

#### Scenario: Ollama native endpoint returns context_length
- **WHEN** the OpenAI-compatible models endpoint yields no usable context length and `POST {base_url}/api/show` returns a response with `model_info.<family>.context_length`
- **THEN** the resolver returns `model_info.<family>.context_length`

#### Scenario: Ollama native endpoint returns num_ctx in parameters
- **WHEN** `POST {base_url}/api/show` returns a response without `model_info.<family>.context_length` but with `num_ctx` in the `parameters` string
- **THEN** the resolver parses and returns `num_ctx`

### Requirement: Resolver does not duplicate the /v1 prefix
The resolver SHALL construct the OpenAI-compatible models URL from `base_url` without duplicating a `/v1` prefix. If `base_url` already ends with `/v1`, the resolver SHALL append `/models` (yielding `{base_url}/models`); otherwise it SHALL append `/v1/models`. The Ollama native `/api/show` endpoint SHALL be constructed relative to the base host, not the `/v1` prefix.

#### Scenario: base_url already ends with /v1
- **WHEN** `base_url` ends with `/v1` (e.g. `https://host/v1`)
- **THEN** the resolver requests `{base_url}/models` (e.g. `https://host/v1/models`), not `{base_url}/v1/models`

#### Scenario: base_url does not contain /v1
- **WHEN** `base_url` does not contain `/v1` (e.g. `https://host`)
- **THEN** the resolver requests `{base_url}/v1/models`

### Requirement: Resolver is defensive and never throws
The resolver SHALL be defensive: on any failure (unreachable, model not found, field absent, non-200), it SHALL move on to the next candidate or return `undefined`. It SHALL never throw.

#### Scenario: Provider unreachable returns undefined
- **WHEN** the provider endpoint is unreachable
- **THEN** the resolver returns `undefined`

#### Scenario: Model not found in the response returns undefined
- **WHEN** the configured model is not found in the OpenAI-compatible models response and the `/api/show` endpoint yields no context length
- **THEN** the resolver returns `undefined`

#### Scenario: max_model_len absent falls through to next candidate
- **WHEN** the OpenAI-compatible models response has no `max_model_len` for the configured model
- **THEN** the resolver moves on to the `/api/show` candidate

#### Scenario: Non-200 response returns undefined
- **WHEN** the provider returns a non-200 status
- **THEN** the resolver returns `undefined`
