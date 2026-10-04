## REMOVED Requirements

### Requirement: Context-cost estimation is extracted into a shared helper
**Reason**: The custom tiktoken-based tokenizer stack is fundamentally broken and is removed entirely. The `estimateContextCost` helper and `toConversation` normalization depended on `calculateConversationTokens`/`flattenMessageContent` from `src/tui/contextTokens.js`, which is deleted.
**Migration**: The `TokenBudget` middleware's `estimateCost` is rewired to use `model.getNumTokensFromMessages(messages)` directly.

### Requirement: toConversation normalizes LangChain messages for tokenization
**Reason**: The `toConversation` helper depended on `flattenMessageContent` from the deleted `src/tui/contextTokens.js`. The custom normalization path is removed.
**Migration**: The `TokenBudget` middleware passes the raw message array to `model.getNumTokensFromMessages(messages)`, which handles content blocks, tool calls, and tool messages natively.

## ADDED Requirements

### Requirement: TokenBudget middleware estimates cost via the model tokenizer
The `TokenBudget` middleware SHALL estimate the cost of a model request by calling `model.getNumTokensFromMessages(messages)` on the request's message array, plus the configured output budget (`maxTokens`). A `maxTokens` value of `-1` (unlimited) SHALL be treated as `0` (no output budget).

#### Scenario: Middleware estimates cost from the model tokenizer
- **WHEN** the `TokenBudget` middleware estimates a request cost
- **THEN** it calls `model.getNumTokensFromMessages(messages)` on the request's message array and adds the output budget

#### Scenario: Middleware normalizes -1 maxTokens to zero
- **WHEN** the `TokenBudget` middleware estimates a request cost with `maxTokens: -1`
- **THEN** it treats `-1` as `0` (no output budget)
