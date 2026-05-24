## ADDED Requirements

### Requirement: Per-Session State Tracking
The system SHALL create a unique session identifier for each TUI invocation and track session-scoped state including the active LLM provider, conversation window size, and current skill context.

#### Scenario: Each TUI session gets a unique ID
- **WHEN** the user launches the harness
- **THEN** the system generates a UUID for the session and associates all memory, telemetry, and config mutations with that ID

#### Scenario: Active provider is tracked per session
- **WHEN** the user switches providers via `:provider set <name>`
- **THEN** the session state records the new provider and uses it for all subsequent LLM calls in that session

### Requirement: Session Context Window
The system SHALL maintain a conversation context window limited to the most recent N exchanges (configurable via `session.context_window_size` in `config.yaml`), discarding older exchanges from the active LLM prompt.

#### Scenario: Context window is enforced
- **WHEN** a conversation exceeds `session.context_window_size` exchanges
- **THEN** the system removes the oldest exchanges from the prompt sent to the LLM while retaining full history in memory

#### Scenario: Context window is configured
- **WHEN** `config.yaml` sets `session.context_window_size: 20`
- **THEN** only the last 20 message exchanges are included in the LLM prompt

### Requirement: Session Memory Loading
On session creation, the system SHALL load the latest conversation file from `memory/` and reconstruct the visible conversation buffer to provide continuity across sessions.

#### Scenario: Session resumes from last conversation
- **WHEN** the harness starts and a previous conversation file exists in `memory/`
- **THEN** the system renders previous messages in the conversation panel up to the context window limit

### Requirement: Runtime Config Mutation
The system SHALL allow session-scoped configuration to be modified at runtime via TUI commands or programmatic API, persisting changes to both in-memory state and `config.yaml` on disk.

#### Scenario: Session mutates memory retention
- **WHEN** the user types `:config set memory.retention.days 7` during an active session
- **THEN** the system updates the retention policy immediately and writes the change to `config.yaml`

#### Scenario: Session mutates skill permissions
- **WHEN** the user types `:config set skills.fs-read.permissions ["filesystem:read"]` during a session
- **THEN** the system updates the registered skill's permission scope for the remainder of the session

### Requirement: Session Shutdown and Cleanup
On session termination, the system SHALL flush all pending telemetry spans, close file handles on memory files, and write a final conversation state to `memory/`.

#### Scenario: Session flushes telemetry on exit
- **WHEN** the user exits the TUI (`Ctrl+C` or `:quit`)
- **THEN** the system signals the OpenTelemetry provider to export all pending spans and waits for completion

#### Scenario: Session writes final memory state
- **WHEN** the session terminates
- **THEN** the system appends any remaining unsaved conversation exchanges to the latest memory file
