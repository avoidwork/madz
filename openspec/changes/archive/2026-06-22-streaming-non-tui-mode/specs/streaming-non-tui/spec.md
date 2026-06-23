## ADDED Requirements

### Requirement: Non-TUI invocations use streaming pipeline
The system SHALL always use the streaming pipeline (`callReactAgentStreaming`) for agent invocations, regardless of whether a user-provided callback is supplied. When no callback is provided, a default stdout callback SHALL be used.

#### Scenario: Non-TUI invocation streams output
- **WHEN** `callReactAgent()` is called without a callback argument
- **THEN** the function uses `callReactAgentStreaming()` with a default stdout callback
- **THEN** text chunks are written to stdout in real-time as they are generated
- **THEN** the function returns `{ content: string }` with the aggregated text

#### Scenario: User-provided callback takes precedence
- **WHEN** `callReactAgent()` is called with a callback argument
- **THEN** the provided callback is used (not the default stdout callback)
- **THEN** TUI mode behavior is unchanged

### Requirement: Default stdout callback writes text chunks
The system SHALL provide a `createStdoutCallback()` function that returns a callback writing text content to stdout.

#### Scenario: Text chunks are written to stdout
- **WHEN** the streaming pipeline emits a `text` event
- **THEN** the stdout callback writes the text content via `process.stdout.write()`
- **THEN** no extra newlines or formatting are added

#### Scenario: Loop detection events are written to stderr
- **WHEN** the streaming pipeline emits a `loop_detected` event
- **THEN** the stdout callback writes a warning to `process.stderr`
- **THEN** the warning does not mix with agent text output

#### Scenario: Non-text events are silently ignored
- **WHEN** the streaming pipeline emits a `tool_start`, `tool_end`, `reasoning`, `compaction_start`, or `compaction_end` event
- **THEN** the stdout callback does not produce any output