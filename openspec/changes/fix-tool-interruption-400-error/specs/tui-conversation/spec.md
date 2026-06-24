## ADDED Requirements

### Requirement: Graceful Error Handling During Tool Interruption
The system SHALL catch and handle non-AbortError errors that occur during an active tool interruption without displaying them as unrecoverable errors. When an interruption is in progress, any error from the dispatch provider SHALL be treated as a graceful interruption and the conversation SHALL be reset to a valid state.

#### Scenario: User interrupts tool execution
- **WHEN** the user interrupts a tool execution (e.g., via escape key or interrupt action)
- **THEN** the system sets an `isInterrupting` flag and signals the abort controller

#### Scenario: Non-AbortError occurs during interruption
- **WHEN** a non-AbortError (e.g., 400 API error) occurs while `isInterrupting` is true
- **THEN** the system catches the error gracefully, resets the conversation state, and allows the user to continue the conversation

#### Scenario: Conversation state is reset after interruption
- **WHEN** an interruption completes
- **THEN** the conversation is reset to a valid state with the system message as the first element

#### Scenario: TUI shows graceful message instead of error during interruption
- **WHEN** an error occurs while `isInterrupting` is true
- **THEN** the TUI displays a graceful interruption message (e.g., "Interrupted") instead of an error message

#### Scenario: Normal errors after interruption are not suppressed
- **WHEN** an error occurs after `isInterrupting` is false (interruption completed)
- **THEN** the system handles the error according to existing error handling logic (no change to current behavior)