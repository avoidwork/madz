## REMOVED Requirements

### Requirement: Context cost is estimated from the checkpointer session
**Reason**: The custom tiktoken-based tokenizer stack is fundamentally broken and is removed entirely. The `computeContextSize` function that normalized the checkpointer message array via `toConversation` and counted it via `calculateConversationTokens` is removed.
**Migration**: The TUI context counter sources messages from `getContextMessages()` and counts them via `model.getNumTokensFromMessages(messages)`.

### Requirement: LangChain messages are normalized for tokenization
**Reason**: The `toConversation`/`flattenMessageContent` normalization path depended on the deleted `src/tui/contextTokens.js`. The custom normalization is removed.
**Migration**: `model.getNumTokensFromMessages(messages)` handles content blocks, tool calls, and tool messages natively.

### Requirement: Tokenization does not double-count
**Reason**: The custom tokenization path that could double-count content blocks, tool calls, and tool messages is removed.
**Migration**: `model.getNumTokensFromMessages(messages)` tokenizes the message array exactly once.

## ADDED Requirements

### Requirement: Context cost is counted via the model tokenizer from the checkpointer
The system SHALL count context cost by calling `model.getNumTokensFromMessages(messages)` on the message array sourced from `agent.getState(config)` → `state.values.messages` via `getContextMessages()`, falling back to `sessionState.getConversation()` when the accessor is unavailable.

#### Scenario: TUI context counter reflects checkpointer state via the model tokenizer
- **WHEN** the TUI computes the context size after a multi-turn conversation with tool calls
- **THEN** it sources the conversation from `getContextMessages()` and counts it via `model.getNumTokensFromMessages(messages)`

#### Scenario: Context counter falls back to sessionState when accessor is unavailable
- **WHEN** the `getContextMessages` accessor is unavailable (e.g., no checkpointer) or returns no messages
- **THEN** the context counter falls back to `sessionState.getConversation()`
