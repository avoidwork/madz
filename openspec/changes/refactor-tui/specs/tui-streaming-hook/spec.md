## ADDED Requirements

### Requirement: Streaming logic is extracted into useStreaming hook
The streaming callback logic SHALL be extracted into a `useStreaming()` hook that manages the AbortController lifecycle, translates stream events into state transitions, and handles the auto-continue circuit breaker.

#### Scenario: AbortController lifecycle management
- **WHEN** a streaming session starts
- **THEN** `useStreaming` creates a new `AbortController` and exposes its signal to the dispatch layer

#### Scenario: Stream event transformation
- **WHEN** a `text` event arrives from the stream
- **THEN** the hook updates the last message's `content` and sets `streaming: true`

#### Scenario: Reasoning event handling
- **WHEN** a `reasoning` event arrives from the stream
- **THEN** the hook updates the last message's `reasoningContent`

#### Scenario: Tool call event handling
- **WHEN** a `tool_start` event arrives
- **THEN** the hook sets `activeToolCall` on the last message
- **WHEN** a `tool_end` event arrives
- **THEN** the hook clears `activeToolCall` and appends to `toolCallDisplay`
- **WHEN** a `tool_error` event arrives
- **THEN** the hook clears `activeToolCall` and appends the error to `toolCallDisplay`

#### Scenario: Compaction event handling
- **WHEN** a `compaction_start` event arrives
- **THEN** the hook sets `isCompacting: true` and `statusMessage: "Compacting context..."`
- **WHEN** a `compaction_end` event arrives
- **THEN** the hook sets `isCompacting: false` and `statusMessage: "Ready"`

#### Scenario: Todo status event handling
- **WHEN** a `todo_status` event arrives
- **THEN** the hook updates the last message's `toolCallDisplay` with the status

### Requirement: Auto-continue circuit breaker is managed by the hook
The auto-continue circuit breaker SHALL be managed within `useStreaming`, tracking consecutive empty responses and triggering the circuit breaker after the configured limit.

#### Scenario: Auto-continue triggers on empty response
- **WHEN** the agent returns zero text output
- **THEN** the hook sends a "Please continue." signal and increments `autoContinueCount`

#### Scenario: Circuit breaker triggers after limit
- **WHEN** `autoContinueCount` reaches `config.agent.autoContinueLimit` (default 1000)
- **THEN** the hook triggers a circuit breaker error and resets the counter

#### Scenario: Counter resets on text output
- **WHEN** any text output arrives during auto-continue
- **THEN** the `autoContinueCount` resets to 0 and `isAutoContinuing` is set to false

### Requirement: Hook exposes clean streaming state to UI
The `useStreaming` hook SHALL expose a `streamingState` object to the UI that contains all streaming-related display state, separating streaming concerns from the UI.

#### Scenario: streamingState contains display fields
- **WHEN** the hook is called
- **THEN** it returns a `streamingState` object containing: `isStreaming`, `isAutoContinuing`, `autoContinueCount`, and `statusMessage`

#### Scenario: Hook provides abort method
- **WHEN** the UI calls the hook's `abort()` method
- **THEN** the AbortController is aborted and streaming is interrupted
