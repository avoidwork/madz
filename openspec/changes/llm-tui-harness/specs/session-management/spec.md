## ADDED Requirements

### Requirement: Session State Machine
The system SHALL manage an active session using a well-defined state machine. Each session has states: `idle`, `prompting`, `processing`, `awaiting_approval`, `paused`, and `failed`. State transitions SHALL be deterministic and validated by the session manager. The system MUST NOT allow invalid state transitions (e.g., processing → idle without first reaching a terminal state).

#### Scenario: Session transitions idle to prompting on user input
- **WHEN** a user sends a message to an idle session
- **THEN** the session state transitions from `idle` to `prompting` to `processing`

#### Scenario: Session enters awaiting_approval for destructive tools
- **WHEN** a processing session encounters a destructive tool
- **THEN** the session state transitions to `awaiting_approval` and pauses tool execution

#### Scenario: Session resumes from awaiting_approval
- **WHEN** the user approves or denies a destructive operation
- **THEN** the session state returns to `processing` (if approved) or `idle` (if denied with no further output)

#### Scenario: Session transitions to failed on error
- **WHEN** a session encounters an unrecoverable error (container crash, adapter failure)
- **THEN** the session state transitions to `failed` and the error message is displayed to the user

### Requirement: Context Window Management
The session manager SHALL track the token or line count of the current context window as messages are added. The manager MUST enforce a maximum context size defined in settings (`settings.session.maxContextLines`). When the context window would exceed the limit, the system SHALL apply a truncation strategy (oldest messages first) and log the truncation event to memory. The system MUST include the context size in the status bar.

#### Scenario: Context grows until limit is reached
- **WHEN** the session processes messages normally
- **THEN** each message increases the context size counter until the configured maximum is reached

#### Scenario: Oldest messages are truncated at limit
- **WHEN** a new message would push the context size beyond `maxContextLines`
- **THEN** the system removes the oldest messages from the context window to fit within the limit

#### Scenario: Context size is displayed in status bar
- **WHEN** the TUI renders the status bar during an active session
- **THEN** the status bar includes the current context size as a percentage or ratio of the maximum (e.g., "context: 65%")

### Requirement: Session Persistence
The system SHALL persist session state (current state, pending inputs, tool call history) to a JSON metadata file in the memory directory on every state transition. On application restart, the system MUST load the most recent session from its metadata file and restore it to the last known state. Restored sessions SHALL be resumable from the point of interruption unless in the `failed` state.

#### Scenario: Session state is persisted on transition
- **WHEN** a session transitions to a new state
- **THEN** the system writes the session metadata to `<session-id>.meta.json` in the memory directory

#### Scenario: Application restores session on restart
- **WHEN** the application starts with a previous session's metadata file present
- **THEN** the system loads the metadata, restores the session state, and resumes operation at the last known point

#### Scenario: Failed session is not resumable
- **WHEN** the application attempts to restore a session with `state: "failed"`
- **THEN** the system displays the failure reason and does not resume — the user must start a new session

### Requirement: Session Commands
The session manager SHALL respond to the following commands: `/new` (create a new session, save current to memory), `/status` (display current session state, context size, registered tools), `/history` (display recent conversation history from the memory file), `/resume` (resume a specified session by ID). Each command SHALL execute atomically without interrupting the current session state machine.

#### Scenario: New session command creates a session
- **WHEN** the user sends `/new` during an active session
- **THEN** the current session is saved to memory, a new session ID is generated, and the session state is reset to `idle`

#### Scenario: Status command displays session details
- **WHEN** the user sends `/status` during an active session
- **THEN** the application displays a summary: session ID, state, context usage, registered tool count, and container status

#### Scenario: Commands are processed during idle state
- **WHEN** the user sends a command while the session is in `idle` state
- **THEN** the command is processed immediately; if in `processing` state, the command is queued and processed after completion
