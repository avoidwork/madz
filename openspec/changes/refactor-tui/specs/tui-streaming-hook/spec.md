## ADDED Requirements

### Requirement: Streaming Hook Abstraction
The TUI SHALL extract all streaming logic into a `useStreaming()` hook that manages the `AbortController` lifecycle, translates stream events into state transitions, and handles the auto-continue circuit breaker.

#### Scenario: Hook manages AbortController lifecycle
- **WHEN** streaming begins
- **THEN** the hook creates a new `AbortController` and exposes its signal

#### Scenario: Hook handles abort signal
- **WHEN** `abort()` is called on the controller
- **THEN** the hook sets `isStreaming` to false and clears the streaming cursor

#### Scenario: Hook transforms stream events
- **WHEN** a stream event arrives (text, reasoning, tool_start, tool_end, tool_error, compaction_start, compaction_end, todo_status)
- **THEN** the hook dispatches the appropriate state update to the reducer

### Requirement: Auto-Continue Circuit Breaker
The `useStreaming()` hook SHALL implement an auto-continue circuit breaker that sends "Please continue." when the agent returns zero text output, repeating up to `config.agent.autoContinueLimit` (default 1000) times.

#### Scenario: Auto-continue triggers on empty response
- **WHEN** the agent returns zero text output
- **THEN** the hook sends a "Please continue." signal and increments the auto-continue counter

#### Scenario: Circuit breaker trips after limit
- **WHEN** the auto-continue counter reaches `config.agent.autoContinueLimit`
- **THEN** the hook stops auto-continuing, sets `isAutoContinuing` to false, and shows an error message

#### Scenario: Counter resets on text output
- **WHEN** any text output arrives during auto-continue
- **THEN** the auto-continue counter resets to zero

### Requirement: Streaming State Exposure
The `useStreaming()` hook SHALL expose a `streamingState` object to the UI containing `isStreaming`, `isAutoContinuing`, `autoContinueCount`, and the current streaming message reference.

#### Scenario: Streaming state reflects current status
- **WHEN** streaming is active
- **THEN** `streamingState.isStreaming` is true and `streamingState.currentMessage` references the active message

#### Scenario: Streaming state resets after abort
- **WHEN** the stream is aborted
- **THEN** `streamingState.isStreaming` is false and `streamingState.currentMessage` is cleared
