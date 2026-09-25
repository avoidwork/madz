## ADDED Requirements

### Requirement: Encoder resolution never passes an encoding name to encoding_for_model
The `calculateConversationTokens` function in `src/tui/contextTokens.js` SHALL NOT pass a tiktoken encoding name (e.g. `cl100k_base`) to `tiktoken.encoding_for_model`, because that API is keyed by model name. When an explicit encoding is configured (via the `encoding` parameter or the `OPENAI_ENCODING` environment variable), the function SHALL resolve it to a model through an explicit encoding→model map (e.g. `cl100k_base` → `gpt-4o`) or obtain the encoder directly by encoding name, so the configured tiktoken encoding is actually used.

#### Scenario: Configured encoding cl100k_base uses tiktoken
- **WHEN** `calculateConversationTokens` is called with `encoding: "cl100k_base"` and a known model
- **THEN** the token count is produced by tiktoken (not the char/4 fallback) and equals the tiktoken count for the same text

#### Scenario: OPENAI_ENCODING env var uses tiktoken
- **WHEN** `OPENAI_ENCODING` is set to `cl100k_base` and `calculateConversationTokens` is called
- **THEN** the token count is produced by tiktoken, not the char/4 fallback

### Requirement: Model-derived encoder resolution
When no explicit encoding is configured, `calculateConversationTokens` SHALL derive the model name from the `modelName` argument (stripping any `:version` suffix) and pass that model name to `tiktoken.encoding_for_model`.

#### Scenario: Known model name resolves via encoding_for_model
- **WHEN** `calculateConversationTokens` is called with model `gpt-4o` and no encoding
- **THEN** the encoder is resolved via `encoding_for_model("gpt-4o")` and the count is a tiktoken count

#### Scenario: Model name with version suffix
- **WHEN** `calculateConversationTokens` is called with model `gpt-4o:2024-08-06` and no encoding
- **THEN** the encoder is resolved from `gpt-4o` (suffix stripped) via tiktoken

### Requirement: Char/4 fallback is last resort only
The character-count heuristic (chars/4) SHALL be used only when tiktoken is unavailable or the model/encoding cannot be resolved to any tiktoken encoder. It SHALL NOT be used when a valid tiktoken encoder is resolvable.

#### Scenario: Unknown model falls back to char/4
- **WHEN** `calculateConversationTokens` is called with a model name that tiktoken does not recognize and no encoding is configured
- **THEN** the char/4 heuristic is used

#### Scenario: Known model does not fall back
- **WHEN** `calculateConversationTokens` is called with a known model (e.g. `gpt-4o`)
- **THEN** the result differs from the char/4 estimate for the same text, proving tiktoken was used
