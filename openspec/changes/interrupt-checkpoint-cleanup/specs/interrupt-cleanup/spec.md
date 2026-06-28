## ADDED Requirements

### Requirement: Interrupt cleanup propagates to LangGraph checkpoint
The system SHALL update the LangGraph checkpoint when removing orphaned tool call messages from in-memory state during interrupt handling.

#### Scenario: Checkpoint updated on chat interrupt
- **WHEN** a user interrupts a tool call via the chat interface
- **THEN** `removeLastAssistantToolCallMessage()` removes the message from in-memory state AND updates the LangGraph checkpoint with the cleaned state

#### Scenario: Checkpoint updated on command interrupt
- **WHEN** a user interrupts a tool call via a command
- **THEN** `handleCommand()` calls `removeLastAssistantToolCallMessage()` before `popExchange()`, updating both in-memory state and the checkpoint

#### Scenario: No orphaned tool calls persist after interrupt
- **WHEN** an interrupt has occurred and cleanup is complete
- **THEN** the LangGraph checkpoint contains no AIMessages with incomplete or orphaned tool_calls

### Requirement: Command path mirrors chat path cleanup
The system SHALL apply identical cleanup logic in both the chat and command interrupt paths.

#### Scenario: handleCommand calls removeLastAssistantToolCallMessage
- **WHEN** a tool call is interrupted via command
- **THEN** `handleCommand()` calls `sessionState.removeLastAssistantToolCallMessage()` before `popExchange()`

#### Scenario: Consistent cleanup across paths
- **WHEN** interrupt occurs via either chat or command path
- **THEN** the resulting in-memory state and checkpoint state are identical

### Requirement: Checkpoint reconciliation on resume
The system SHALL verify checkpoint consistency before resuming a conversation after an interrupt.

#### Scenario: Reconciliation runs after interrupt
- **WHEN** a new message is sent after an interrupt occurred
- **THEN** the system compares checkpoint state with in-memory conversation before calling `dispatchProvider`

#### Scenario: Divergent state is reconciled
- **WHEN** checkpoint state differs from in-memory conversation after an interrupt
- **THEN** the system writes the cleaned in-memory state to the checkpoint before resuming

#### Scenario: Normal resume unaffected
- **WHEN** a message is sent without a prior interrupt
- **THEN** no reconciliation check is performed and resume behavior is unchanged

### Requirement: Integration test covers interrupt/resume scenario
The system SHALL include an integration test that verifies checkpoint consistency after interrupt and resume.

#### Scenario: Test simulates interrupt during tool execution
- **WHEN** the test triggers a tool call and then simulates an interrupt
- **THEN** the checkpoint contains no orphaned tool call messages

#### Scenario: Test verifies resume after interrupt
- **WHEN** the test sends a new message after the interrupt
- **THEN** the resumed conversation contains no duplicate tool calls or dangling references

#### Scenario: Test covers both interrupt paths
- **WHEN** the test runs for both chat and command interrupt scenarios
- **THEN** both paths produce clean checkpoint state with no orphaned messages