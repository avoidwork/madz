## REMOVED Requirements

### Requirement: Context cost is estimated from conversation, system prompt, and output budget
**Reason**: The custom tiktoken-based tokenizer stack is fundamentally broken and is removed entirely. The TUI context counter's `computeContextSize` depended on `estimateContextCost`/`calculateConversationTokens` from the deleted `src/tui/contextTokens.js`.
**Migration**: The TUI context counter is rewired to use `model.getNumTokensFromMessages(messages)` directly.

### Requirement: Context-cost helper is exported and reusable
**Reason**: The exported `estimateContextCost` helper in `src/provider/tokenBudgetMiddleware.js` depended on the deleted `calculateConversationTokens` from `src/tui/contextTokens.js`. The helper is removed.
**Migration**: The TUI context counter calls `model.getNumTokensFromMessages(messages)` directly.

## ADDED Requirements

### Requirement: TUI context counter uses the model tokenizer
The TUI context counter SHALL compute the context size by calling `model.getNumTokensFromMessages(messages)` on the message array sourced from `getContextMessages()`, falling back to `sessionState.getConversation()` when the accessor is unavailable.

#### Scenario: Counter uses the model tokenizer on the context messages
- **WHEN** the TUI computes the context size for a session
- **THEN** it calls `model.getNumTokensFromMessages(messages)` on the message array from `getContextMessages()`

#### Scenario: Counter falls back to sessionState when accessor is unavailable
- **WHEN** `getContextMessages()` is unavailable or returns no messages
- **THEN** the context counter falls back to `sessionState.getConversation()`
