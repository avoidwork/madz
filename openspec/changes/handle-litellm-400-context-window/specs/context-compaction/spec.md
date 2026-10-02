## ADDED Requirements

### Requirement: System detects 400 ContextWindowExceededError and compacts
The system SHALL detect a 400 `ContextWindowExceededError` from the LLM provider in the innermost middleware, compact the context via the existing compaction path, and re-send the request once. Detection SHALL require both an HTTP status of 400 and an error message matching a context-window pattern (e.g. containing "context", "context length", "context window", or "maximum ... length"), so non-context 400 errors (e.g. invalid API key) are not compacted.

#### Scenario: Detect a 400 context-window error and retry once
- **WHEN** the LLM returns a 400 error with message "This model's maximum context length is 128000 tokens"
- **THEN** the system compacts the context and re-sends the request once

#### Scenario: Non-context 400 error is not compacted
- **WHEN** the LLM returns a 400 error with message "Invalid API key"
- **THEN** the system does NOT compact and propagates the error normally

#### Scenario: Retry after compaction succeeds
- **WHEN** the request is re-sent with compacted context and succeeds
- **THEN** the system returns the LLM response to the user normally

#### Scenario: Retry after compaction still fails with a context-window error
- **WHEN** the re-sent request also fails with a 400 context-window error
- **THEN** the system surfaces the error to the user
