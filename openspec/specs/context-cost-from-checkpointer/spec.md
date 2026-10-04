# context-cost-from-checkpointer Specification

## Purpose
TBD - created by archiving change context-cost-from-checkpointer. Update Purpose after archive.
## Requirements
### Requirement: Context cost is counted via the model tokenizer from the checkpointer
The system SHALL count context cost by calling `model.getNumTokensFromMessages(messages)` on the message array sourced from `agent.getState(config)` → `state.values.messages` via `getContextMessages()`, falling back to `sessionState.getConversation()` when the accessor is unavailable.

#### Scenario: TUI context counter reflects checkpointer state via the model tokenizer
- **WHEN** the TUI computes the context size after a multi-turn conversation with tool calls
- **THEN** it sources the conversation from `getContextMessages()` and counts it via `model.getNumTokensFromMessages(messages)`

#### Scenario: Context counter falls back to sessionState when accessor is unavailable
- **WHEN** the `getContextMessages` accessor is unavailable (e.g., no checkpointer) or returns no messages
- **THEN** the context counter falls back to `sessionState.getConversation()`

