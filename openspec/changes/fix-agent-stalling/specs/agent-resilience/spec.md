## ADDED Requirements

### Requirement: Agent must not stall without output
The agent SHALL produce text output for every user message. When the agent reaches its reasoning limit or completes a stream without emitting text, it MUST return the recursion limit message instead of echoing the user's input.

#### Scenario: Agent completes with text
- **WHEN** the agent streams events and emits text content
- **THEN** the text content is returned as the response

#### Scenario: Agent completes without text
- **WHEN** the agent's event stream completes without emitting any text content
- **THEN** the system returns the recursion limit message: "I've reached the maximum number of reasoning steps on this thread. Please continue your message and I'll carry on, or start a new session if you'd prefer."

#### Scenario: Agent hits recursion limit
- **WHEN** the agent throws a GraphRecursionError
- **THEN** the system returns the recursion limit message

### Requirement: Agent recursion limit must accommodate complex tasks
The agent's default recursion limit SHALL be at least 50 reasoning steps to accommodate complex multi-step tasks involving multiple tool calls.

#### Scenario: Default recursion limit
- **WHEN** no custom `recursionLimit` is configured
- **THEN** the agent uses a default of 50 steps

#### Scenario: Custom recursion limit
- **WHEN** `agent.recursionLimit` is set in config
- **THEN** the agent uses the configured value
