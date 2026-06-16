## ADDED Requirements

### Requirement: Streaming Hook Abstraction
The system SHALL provide a `useStreaming()` hook that manages the `AbortController` lifecycle, transforms stream events into state updates, and handles the auto-continue circuit breaker.

#### Scenario: Hook initializes AbortController
- **WHEN** the useStreaming hook is invoked
- **THEN** an AbortController is created and its signal is available for the dispatch call

#### Scenario: Hook handles text stream events
- **WHEN** a 'text' stream event is received
- **THEN** the hook updates the last message's content and sets streaming=true

#### Scenario: Hook handles reasoning events
- **WHEN** a 'reasoning' stream event is received
- **THEN** the hook updates the last message's reasoningContent

#### Scenario: Hook handles tool call events
- **WHEN** a 'tool_start' stream event is received
- **THEN** the hook sets activeToolCall on the last message
- **WHEN** a 'tool_end' stream event is received
- **THEN** the hook clears activeToolCall and appends to toolCallDisplay

#### Scenario: Hook handles compaction events
- **WHEN** a 'compaction_start' stream event is received
- **THEN** the hook sets isCompacting=true and statusMessage="Compacting context..."
- **WHEN** a 'compaction_end' stream event is received
- **THEN** the hook sets isCompacting=false and statusMessage="Ready"

### Requirement: Auto-Continue Circuit Breaker
The system SHALL automatically send a "Please continue." signal when the agent returns zero text output, repeating up to `config.agent.autoContinueLimit` (default 1000) times before triggering a circuit breaker error.

#### Scenario: Auto-continue activates on empty response
- **WHEN** the streaming hook receives a text event with zero content
- **THEN** the auto-continue counter increments and a "Please continue." signal is sent

#### Scenario: Auto-continue resets on content
- **WHEN** the streaming hook receives a text event with non-zero content
- **THEN** the auto-continue counter resets to zero

#### Scenario: Circuit breaker triggers after limit
- **WHEN** the auto-continue counter reaches config.agent.autoContinueLimit
- **THEN** the circuit breaker triggers, shows an error message, and resets the counter

### Requirement: Streaming Abort Handling
The system SHALL provide abort handling through the hook that clears the streaming cursor, sets isStreaming=false, and awaits the dispatch promise.

#### Scenario: Abort clears streaming state
- **WHEN** the abort signal is triggered
- **THEN** the hook clears the streaming cursor from the last message and sets isStreaming=false
