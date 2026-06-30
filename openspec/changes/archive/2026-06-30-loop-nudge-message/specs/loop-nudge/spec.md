## ADDED Requirements

### Requirement: System injects nudge message when loop is detected
When the agent enters a repetitive loop and the nudge limit has not been reached, the system SHALL inject a nudge message into the conversation so the agent can see it and try a different approach.

#### Scenario: Nudge injected on first loop detection
- **WHEN** the agent enters a repetitive loop and no nudge has been injected yet
- **THEN** a nudge message is injected into the conversation as a `user` message with the configured nudge text

#### Scenario: Nudge uses default message when not configured
- **WHEN** `agent.loopMsg` is not set in config and `AGENT_LOOP_MSG` env var is not set
- **THEN** the system uses the default nudge message: "You are in a repetitive loop. Try a different approach."

#### Scenario: Nudge uses configured message when set
- **WHEN** `agent.loopMsg` is set in config or `AGENT_LOOP_MSG` env var is set
- **THEN** the system uses the configured message as the nudge text

### Requirement: System enforces maximum nudge count
The system SHALL track the number of nudge messages injected and stop injecting nudges after the configured limit is reached.

#### Scenario: Nudge injected within limit
- **WHEN** the number of previously injected nudges is less than `agent.loopLimit`
- **THEN** a new nudge message is injected into the conversation

#### Scenario: Nudge not injected after limit reached
- **WHEN** the number of previously injected nudges equals or exceeds `agent.loopLimit`
- **THEN** no nudge message is injected, but loop detection continues for UI purposes

#### Scenario: Default limit is 5
- **WHEN** `agent.loopLimit` is not set in config and `AGENT_LOOP_LIMIT` env var is not set
- **THEN** the system uses a default limit of 5 nudge messages

#### Scenario: Nudge count resets on session clear
- **WHEN** the conversation/session is cleared
- **THEN** the nudge count is reset to 0

### Requirement: Nudge message is visible to the agent
The nudge message SHALL be injected as a `user` message type so the agent sees it as part of the conversation input.

#### Scenario: Nudge is user message type
- **WHEN** a nudge is injected into the conversation
- **THEN** the nudge message has type `user` so the agent processes it as conversation input

#### Scenario: Nudge does not count as agent turn
- **WHEN** a nudge message is injected into the conversation
- **THEN** the nudge message is not counted as an agent turn in the turn hash tracking

### Requirement: Existing UI nudge continues to work
The existing TUI nudge display SHALL continue to work independently of the conversation nudge injection.

#### Scenario: UI nudge still displayed
- **WHEN** a loop is detected
- **THEN** the TUI continues to display "You're looping." to the user as before

#### Scenario: UI nudge independent of conversation nudge
- **WHEN** the nudge limit has been reached and no conversation nudge is injected
- **THEN** the TUI still displays the UI nudge "You're looping." to the user