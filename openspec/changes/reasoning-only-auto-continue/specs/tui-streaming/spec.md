# Spec Delta

## ADDED Requirements

### Requirement: Stream consumer SHALL track the last event type

The stream consumer SHALL track the last non-subagent event type forwarded to the streaming callback and expose it as `lastEventType` in the resolved response.

#### Scenario: Turn ends on reasoning

- **WHEN** a turn emits reasoning as its final non-subagent event
- **THEN** the resolved response carries `lastEventType` equal to `"reasoning"`

#### Scenario: Turn ends on a message

- **WHEN** a turn emits a message as its final non-subagent event
- **THEN** the resolved response carries `lastEventType` equal to `"message"`

#### Scenario: Subagent events do not set lastEventType

- **WHEN** a subagent emits a `subagent_reasoning` event after the orchestrator's last event
- **THEN** `lastEventType` remains the orchestrator's last non-subagent event type

### Requirement: Message list SHALL expose the last message ID

The message list SHALL expose a method returning the ID of the last message in the ordered list, or `undefined` when the list is empty.

#### Scenario: Non-empty list

- **WHEN** the message list contains at least one message
- **THEN** the method returns the ID of the most recently added message

#### Scenario: Empty list

- **WHEN** the message list is empty
- **THEN** the method returns `undefined`

### Requirement: TUI SHALL auto-continue only when the last bubble ends on reasoning

The TUI SHALL dispatch a silent "Continue" user message only when the streaming assistant bubble is the last in the message list AND it ended with reasoning as its last event AND the auto-continue loop guard is not exhausted.

#### Scenario: Last bubble ends on reasoning

- **WHEN** the streaming bubble is the last in the list and its last event type is `reasoning` and the loop guard is not exhausted
- **THEN** the TUI dispatches a silent "Continue" user message

#### Scenario: Earlier incomplete bubble does not trigger

- **WHEN** an earlier bubble is still streaming while a later bubble ends on reasoning
- **THEN** the TUI does not dispatch a "Continue" for the earlier bubble

#### Scenario: Reasoning followed by a tool call does not trigger

- **WHEN** the last event type is a tool event rather than `reasoning`
- **THEN** the TUI does not dispatch a "Continue"

#### Scenario: Loop guard exhausted

- **WHEN** the auto-continue count reaches the configured limit
- **THEN** the TUI does not dispatch further "Continue" messages

### Requirement: Auto-continue limit SHALL be configurable

The auto-continue loop guard SHALL be configurable via `agent.autoContinueLimit`, defaulting to 1000.

#### Scenario: Default limit

- **WHEN** `agent.autoContinueLimit` is not configured
- **THEN** the loop guard uses a default of 1000

#### Scenario: Configured limit

- **WHEN** `agent.autoContinueLimit` is set to a positive integer
- **THEN** the loop guard uses that value
