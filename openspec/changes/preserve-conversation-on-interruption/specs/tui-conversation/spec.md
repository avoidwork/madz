## ADDED Requirements

### Requirement: Conversation Persistence on Interruption
The system SHALL preserve conversation checkpoints when an interruption occurs (e.g., user sends interrupt signal, kills the process, or disconnects), allowing the user to resume the conversation from the exact point of interruption.

#### Scenario: User interrupts streaming conversation
- **WHEN** the user interrupts a streaming conversation (e.g., via escape key, Ctrl+C, or kill signal)
- **THEN** the system preserves the conversation checkpoint and does not delete the thread

#### Scenario: User resumes interrupted conversation
- **WHEN** the user restarts the application after an interruption
- **THEN** the system loads the preserved conversation checkpoint and resumes from the point of interruption

#### Scenario: User explicitly quits conversation
- **WHEN** the user explicitly quits the conversation (e.g., via `:q` command)
- **THEN** the system deletes the conversation checkpoint as expected

#### Scenario: Non-interruption errors still behave normally
- **WHEN** a non-AbortError occurs during conversation (e.g., network error, provider error)
- **THEN** the system handles the error according to existing error handling logic (no change to current behavior)