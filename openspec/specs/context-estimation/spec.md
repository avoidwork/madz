# context-estimation Specification

## Purpose
TBD - created by archiving change fix-status-bar-context-counter. Update Purpose after archive.
## Requirements
### Requirement: TUI context counter uses the model tokenizer
The TUI context counter SHALL compute the context size by calling `model.getNumTokensFromMessages(messages)` on the message array sourced from `getContextMessages()`, falling back to `sessionState.getConversation()` when the accessor is unavailable.

#### Scenario: Counter uses the model tokenizer on the context messages
- **WHEN** the TUI computes the context size for a session
- **THEN** it calls `model.getNumTokensFromMessages(messages)` on the message array from `getContextMessages()`

#### Scenario: Counter falls back to sessionState when accessor is unavailable
- **WHEN** `getContextMessages()` is unavailable or returns no messages
- **THEN** the context counter falls back to `sessionState.getConversation()`

