## MODIFIED Requirements

### Requirement: Context cost is counted via the model tokenizer from the checkpointer
The system SHALL count context cost by calling `model.getNumTokensFromMessages(messages)` on the message array sourced from `agent.getState(config)` → `state.values.messages` via `getContextMessages()`, falling back to `sessionState.getConversation()` when the accessor is unavailable. During streaming, the live counter SHALL additionally include tool-message tokens as they stream in, so the displayed context size reflects tool messages before the turn completes.

#### Scenario: TUI context counter reflects checkpointer state via the model tokenizer
- **WHEN** the TUI computes the context size after a multi-turn conversation with tool calls
- **THEN** it sources the conversation from `getContextMessages()` and counts it via `model.getNumTokensFromMessages(messages)`

#### Scenario: Context counter falls back to sessionState when accessor is unavailable
- **WHEN** the `getContextMessages` accessor is unavailable (e.g., no checkpointer) or returns no messages
- **THEN** the context counter falls back to `sessionState.getConversation()`

#### Scenario: Live streaming counter includes tool-message tokens
- **WHEN** the TUI is streaming a turn that produces tool messages
- **THEN** the live context counter includes the tool-message tokens in addition to the assistant message content
