## MODIFIED Requirements

### Requirement: Interrupt cleanup removes assistant tool-call messages from session state and checkpoint
When a tool execution is interrupted, the TUI SHALL remove the assistant's AIMessage containing tool_calls from the session state conversation array AND from the LangGraph checkpoint. This ensures both the in-memory conversation history and the persistent checkpoint are consistent and do not contain orphaned tool calls.

#### Scenario: Interrupt during tool execution removes assistant tool-call message from session state
- **WHEN** a tool is executing and the user triggers an interrupt
- **THEN** the `handleInterrupt()` function removes the last assistant message with tool_calls from `sessionState.conversation`
- **AND** the user's message is also removed via `popExchange()`
- **AND** the conversation array no longer contains the orphaned assistant tool-call message

#### Scenario: Interrupt during tool execution removes assistant tool-call message from checkpoint
- **WHEN** a tool is executing and the user triggers an interrupt
- **THEN** the checkpoint for the current `thread_id` is updated to remove the partial AIMessage with tool_calls
- **AND** the checkpoint state no longer contains orphaned tool call references
- **AND** subsequent `streamEvents` replay does not include the orphaned message

#### Scenario: Interrupt during normal text response preserves conversation
- **WHEN** the assistant is responding with text (no tool calls) and the user triggers an interrupt
- **THEN** the cleanup logic does not remove any assistant message (no tool_calls to clean up)
- **AND** only the user's message is removed via `popExchange()`
- **AND** the conversation remains consistent

#### Scenario: Interrupt with no assistant message is safe
- **WHEN** an interrupt is triggered but no assistant message exists in the conversation
- **THEN** the cleanup helper function performs no removal (no-op)
- **AND** no error is thrown
- **AND** the conversation state is unchanged

### Requirement: Cleanup helper is idempotent and defensive
The helper function that removes assistant tool-call messages SHALL be safe to call multiple times and SHALL not throw errors when no matching message exists. It SHALL operate on both in-memory state and the LangGraph checkpoint when a checkpointer is provided.

#### Scenario: Calling cleanup helper multiple times is safe
- **WHEN** the cleanup helper is called when no assistant tool-call message exists
- **THEN** the function returns without modifying the conversation array
- **AND** no error is thrown

#### Scenario: Cleanup helper handles empty conversation
- **WHEN** the conversation array is empty
- **THEN** the cleanup helper returns without modifying state
- **AND** no error is thrown

#### Scenario: Cleanup helper is safe when checkpoint has no matching message
- **WHEN** the cleanup helper is called with a checkpointer but the checkpoint has no matching message
- **THEN** the function returns without modifying the checkpoint
- **AND** no error is thrown

### Requirement: Cleanup occurs before next LLM dispatch with checkpoint consistency
After interrupt cleanup completes, both the session state AND the LangGraph checkpoint SHALL be consistent before the next dispatch to the LLM API, ensuring the system message remains at position 0 in the messages array and the checkpoint contains no orphaned messages.

#### Scenario: Conversation is clean before resume dispatch
- **WHEN** an interrupt completes and the user sends a new message
- **THEN** the conversation sent to the LLM API does not contain orphaned assistant messages with tool_calls
- **AND** the checkpoint does not contain orphaned assistant messages with tool_calls
- **AND** the LLM API accepts the request without a 400 error
- **AND** the conversation continues normally

#### Scenario: Checkpoint reconciliation before resume
- **WHEN** an interrupt completes and the user sends a new message
- **THEN** the checkpoint state is reconciled with the in-memory conversation before `dispatchProvider` is called
- **AND** any divergence between checkpoint and in-memory state is resolved by writing the cleaned state to the checkpoint