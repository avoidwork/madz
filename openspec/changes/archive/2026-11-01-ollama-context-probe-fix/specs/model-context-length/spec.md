# Spec Delta

## ADDED Requirements

### Requirement: Ollama native endpoint returns context_length from flat model_info
The resolver SHALL parse the Ollama `/api/show` response's `model_info` as a flat object of dotted keys (e.g. `"<family>.context_length"`), not as nested family objects. When the OpenAI-compatible models endpoint yields no usable context length and `POST {base_url}/api/show` returns a `model_info` entry whose key ends in `.context_length` with a numeric value, the resolver SHALL return that value.

#### Scenario: Ollama flat model_info returns context_length
- **WHEN** the OpenAI-compatible models endpoint yields no usable context length and `POST {base_url}/api/show` returns `model_info` containing a key ending in `.context_length` (e.g. `"gemma4.context_length"`) with a numeric value
- **THEN** the resolver returns that numeric value

#### Scenario: Ollama nested family object is not a valid shape
- **WHEN** `POST {base_url}/api/show` returns `model_info` as a nested family object (e.g. `{ "gemma4": { "context_length": 131072 } }`)
- **THEN** the resolver does not treat the nested value as a usable context length and falls through to the `num_ctx` fallback

### Requirement: Ollama effective_context_length takes precedence over native
When the Ollama `/api/show` response's `model_info` contains both a `"<family>.effective_context_length"` and a `"<family>.context_length"` key, the resolver SHALL return the `effective_context_length` value, since it reflects the runtime cap (`min(native, OLLAMA_CONTEXT_LENGTH)`).

#### Scenario: effective_context_length present
- **WHEN** `POST {base_url}/api/show` returns `model_info` containing both `"gemma4.context_length"` and `"gemma4.effective_context_length"` with numeric values
- **THEN** the resolver returns the `effective_context_length` value, not the native `context_length`

#### Scenario: effective_context_length absent falls back to native
- **WHEN** `POST {base_url}/api/show` returns `model_info` containing `"gemma4.context_length"` but no `effective_context_length`
- **THEN** the resolver returns the native `context_length` value
