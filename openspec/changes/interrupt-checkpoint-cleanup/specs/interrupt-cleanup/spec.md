## ADDED Requirements

### Requirement: Interrupt cleanup propagates to LangGraph checkpoint
The system SHALL propagate session state cleanup to the LangGraph checkpoint when an interrupt occurs during tool execution, ensuring no orphaned AIMessages with tool_calls persist in the checkpoint.

#### Scenario: Interrupt during tool call cleans checkpoint
- **WHEN** a tool call is interrupted (via command or cancel)
- **THEN** the LangGraph checkpoint is updated to remove the partial AIMessage containing the tool_call
- **AND** the in-memory conversation state is also cleaned of the partial message

#### Scenario: No orphaned tool calls after interrupt and resume
- **WHEN** a user interrupts a tool call and then sends a new message to resume
- **THEN** the resumed conversation contains no duplicate tool calls
- **AND** the LLM API request does not include dangling tool references

#### Scenario: Checkpoint cleanup with checkpointer provided
- **WHEN** `removeLastAssistantToolCallMessage()` is called with a checkpointer parameter
- **THEN** the function removes the message from in-memory conversation
- **AND** the function updates the LangGraph checkpoint to remove the corresponding message

### Requirement: Consistent cleanup across interrupt paths
The system SHALL perform identical cleanup operations in both `handleChat()` and `handleCommand()` interrupt paths, ensuring tool call messages are removed from in-memory state regardless of how the interrupt was triggered.

#### Scenario: handleCommand() cleans tool call messages
- **WHEN** an interrupt occurs via a command (not chat message)
- **THEN** `removeLastAssistantToolCallMessage()` is called to clean tool call messages
- **AND** `popExchange()` is called to clean the exchange state

#### Scenario: handleChat() cleans tool call messages
- **WHEN** an interrupt occurs during chat message processing
- **THEN** `removeLastAssistantToolCallMessage()` is called to clean tool call messages
- **AND** `popExchange()` is called to clean the exchange state

### Requirement: Checkpoint reconciliation on resume
The system SHALL reconcile the LangGraph checkpoint with in-memory conversation state before resuming after an interrupt, ensuring the graph starts from a consistent state.

#### Scenario: Reconciliation before dispatchProvider
- **WHEN** a new message is sent after an interrupt
- **THEN** the system compares checkpoint state with in-memory conversation before calling `dispatchProvider`
- **AND** if the states diverge, the cleaned state is written to the checkpoint

#### Scenario: Normal resume without reconciliation needed
- **WHEN** a conversation resumes without a prior interrupt
- **THEN** no reconciliation is performed (checkpoint and in-memory state are already consistent)
- **AND** `dispatchProvider` proceeds normally

### Requirement: Graceful degradation on checkpoint cleanup failure
The system SHALL gracefully handle failures during checkpoint cleanup, ensuring in-memory cleanup still proceeds even if checkpoint update fails.

#### Scenario: Checkpointer unavailable
- **WHEN** the checkpointer is not available during interrupt cleanup
- **THEN** in-memory cleanup proceeds normally
- **AND** a warning is logged indicating checkpoint cleanup was skipped

#### Scenario: Checkpoint update error
- **WHEN** the checkpoint update fails with an error
- **THEN** in-memory cleanup proceeds normally
- **AND** the error is logged for debugging
- **AND** the reconciliation step on resume will address the inconsistency