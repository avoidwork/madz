## ADDED Requirements

### Requirement: Per-Session State Tracking
The system SHALL create a unique session identifier for each TUI invocation and track session-scoped state including the active LLM provider, conversation window size, and current skill context. The session's `sessionId` MUST be passed as `configurable.thread_id` to LangGraph agent invocations, enabling the checkpointer to associate all checkpoints with the correct conversation thread.

#### Scenario: Each TUI session gets a unique ID
- **WHEN** the harness starts and creates a session
- **THEN** the system generates a UUID for the session and uses it as the LangGraph `thread_id` for all agent invocations

#### Scenario: Active provider is tracked per session
- **WHEN** the user switches providers via `:provider set <name>`
- **THEN** the session state records the new provider and uses it for all subsequent LLM calls in that session

### Requirement: Thread-Based Conversation Memory
The system SHALL pass the session's `sessionId` as `configurable.thread_id` to every agent invocation (both non-streaming and streaming), enabling the LangGraph checkpointer to persist and resume conversation state within that thread.

#### Scenario: Multi-turn conversation accumulates in memory
- **WHEN** the user sends multiple messages in the same session (via TUI or CLI)
- **THEN** the agent's checkpointer saves the conversation state after each super-step
- **THEN** subsequent invocations with the same `thread_id` resume from the last checkpoint and include prior message history

#### Scenario: New thread_id creates independent conversation
- **WHEN** a new session is created with a different `sessionId`
- **THEN** the agent starts with a fresh conversation with no prior message history
- **THEN** the previous session's messages are not visible in the new thread

### Requirement: Session Memory Loading
On session creation, the system SHALL load the latest conversation file from `memory/` and reconstruct the visible conversation buffer to provide continuity across sessions, up to the context window limit.

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
