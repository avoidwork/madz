## ADDED Requirements

### Requirement: New Session Command (`:new`)
The system SHALL allow users to start a fresh conversation session via the `:new` TUI command, resetting the conversation history and generating a new session identifier while preserving provider and tool configuration.

#### Scenario: User starts a new session
- **WHEN** the user types `:new` in command mode
- **THEN** the system generates a new UUID session ID, clears the conversation history, clears the TUI chat history buffer, and displays a system message confirming the new session

#### Scenario: New session retains tool and provider configuration
- **WHEN** the user starts a new session via `:new` after using a specific provider and skills
- **THEN** the new session uses the same LLM provider, agent configuration, and skill permissions as the previous session

### Requirement: Manual Context Compaction (`:compact`)
The system SHALL allow users to manually compact the conversation context via the `:compact` TUI command, which summarizes the full conversation history using the LLM and replaces the history with a condensed version.

#### Scenario: User triggers manual compaction
- **WHEN** the user types `:compact` in command mode
- **THEN** the system displays a "Compacting..." status message, sends the conversation history to the LLM for summarization, replaces the full conversation with a single system-level summary message (plus the last 2 exchanges), and displays a completion message

#### Scenario: Compaction preserves recent exchanges
- **WHEN** the conversation has been compacted
- **THEN** the last 2 exchanges (user prompts and assistant responses) are preserved after the summary message for continuity

#### Scenario: Compaction fails gracefully
- **WHEN** the LLM summarization call for compaction fails
- **THEN** the system displays an error message and leaves the conversation history unchanged

### Requirement: Auto-Trigger Compaction on Context Overflow
The system SHALL detect context-length overflow errors from the LLM provider, automatically trigger a compaction, and retry the failed message after the conversation has been compacted.

#### Scenario: Error triggers compaction
- **WHEN** the LLM provider returns a context-length exceeded error (error code `context_length_exceeded` or equivalent) during message dispatch
- **THEN** the system automatically triggers compaction, retries the failed user message after the conversation has been compacted, and displays a system message indicating the compaction occurred

#### Scenario: Auto-compaction retry succeeds
- **WHEN** a message fails due to context overflow, compaction runs, and the retry succeeds
- **THEN** the system displays the assistant's response and continues normal conversation flow

#### Scenario: Auto-compaction retry fails again
- **WHEN** a message fails due to context overflow, compaction runs, and the retry also fails with a context-length exceeded error
- **THEN** the system displays a hard error message suggesting the user type `:new` to start a fresh session, and does not retry further

### Requirement: Compactable Conversation State
The session state SHALL track whether a conversation is in a compacted state to prevent redundant compaction attempts and to allow status display.

#### Scenario: Compacted state is tracked
- **WHEN** a conversation is compacted
- **THEN** the session state records a flag indicating the conversation is in a compacted state
#### Scenario: New session clears compacted flag
- **WHEN** the user starts a new session via `:new`
- **THEN** the compacted state flag is reset

### Requirement: Session Memory Persistence After Compaction
After compaction, the system SHALL persist the compacted conversation state to the memory store so that the summary survives across session restarts.

#### Scenario: Compacted state persists to disk
- **WHEN** a conversation is compacted
- **THEN** the system writes the compacted conversation (summary + preserved exchanges) to the active memory conversation file
