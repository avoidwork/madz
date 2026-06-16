## ADDED Requirements

### Requirement: Extracted Streaming Hook
The TUI SHALL extract all streaming logic into a dedicated `useStreaming()` hook that manages the `AbortController` lifecycle, translates stream events into state transitions, and handles the auto-continue circuit breaker.

#### Scenario: Hook manages AbortController lifecycle
- **WHEN** streaming begins
- **THEN** the hook creates an `AbortController` and exposes its signal
- **WHEN** streaming ends or is interrupted
- **THEN** the hook aborts the controller and cleans up

#### Scenario: Stream events are transformed into state updates
- **WHEN** a `text` event arrives
- **THEN** the hook updates the last message's `content` and sets `streaming: true`
- **WHEN** a `reasoning` event arrives
- **THEN** the hook updates the last message's `reasoningContent`
- **WHEN** a `tool_start` event arrives
- **THEN** the hook sets `activeToolCall` on the last message
- **WHEN** a `tool_end` event arrives
- **THEN** the hook clears `activeToolCall` and appends to `toolCallDisplay`
- **WHEN** a `tool_error` event arrives
- **THEN** the hook clears `activeToolCall` and appends the error to `toolCallDisplay`
- **WHEN** a `compaction_start` event arrives
- **THEN** the hook sets `isCompacting: true` and `statusMessage: 'Compacting context...'`
- **WHEN** a `compaction_end` event arrives
- **THEN** the hook sets `isCompacting: false` and `statusMessage: 'Ready'`
- **WHEN** a `todo_status` event arrives
- **THEN** the hook updates `toolCallDisplay` on the last message

#### Scenario: Auto-continue circuit breaker activates
- **WHEN** the agent returns zero text output
- **THEN** the hook automatically sends a "Please continue." signal
- **WHEN** the auto-continue count reaches `config.agent.autoContinueLimit` (default 1000)
- **THEN** the hook triggers a circuit breaker error and stops auto-continuing
- **WHEN** any text output arrives during auto-continue
- **THEN** the hook resets the auto-continue counter

#### Scenario: Hook exposes clean streaming state
- **WHEN** the hook is consumed by the UI
- **THEN** it exposes a `streamingState` object containing `isStreaming`, `isAutoContinuing`, `autoContinueCount`, and the current `AbortSignal`
