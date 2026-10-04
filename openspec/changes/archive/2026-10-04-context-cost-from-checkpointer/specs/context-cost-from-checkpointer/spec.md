## ADDED Requirements

### Requirement: Context cost is estimated from the checkpointer session
The system SHALL estimate context cost from the real LangGraph checkpointer session via `agent.getState(config)` → `state.values.messages`, rather than the lossy `sessionState.getConversation()` array. The real message array SHALL be normalized into the `{role, content}` shape expected by `calculateConversationTokens`, preserving tool-call and tool-message text.

#### Scenario: TUI context counter reflects checkpointer state
- **WHEN** the TUI computes the context size after a multi-turn conversation with tool calls
- **THEN** it sources the conversation from `agent.getState(config)` → `state.values.messages` and the counter reflects the real message array

#### Scenario: Context counter falls back to sessionState when accessor is unavailable
- **WHEN** the `getContextMessages` accessor is unavailable (e.g., no checkpointer) or returns no messages
- **THEN** the context counter falls back to `sessionState.getConversation()`

### Requirement: LangChain messages are normalized for tokenization
The system SHALL normalize LangChain messages with content blocks, tool calls, and tool messages into the `{role, content}` shape that `calculateConversationTokens` expects, preserving tool-call/tool-message text so the estimate is not under-counted.

#### Scenario: Content blocks are flattened to text
- **WHEN** a LangChain message has an array of content blocks (e.g., text, image_url)
- **THEN** the blocks are flattened to a single string for tokenization

#### Scenario: Tool calls on assistant messages are preserved
- **WHEN** an assistant message carries `tool_calls`
- **THEN** the tool-call text is included in the normalized content so the estimate is not under-counted

#### Scenario: Tool messages are preserved
- **WHEN** a `tool` role message is present in the message array
- **THEN** its content is included in the normalized conversation

### Requirement: Tokenization does not double-count
The system SHALL tokenize the normalized message array without double-counting content blocks, tool calls, or tool messages.

#### Scenario: Normalized messages are tokenized once
- **WHEN** `calculateConversationTokens` receives a normalized `{role, content}` array
- **THEN** each message's content is tokenized exactly once
