## ADDED Requirements

### Requirement: Unified process tool with action-based routing
The system SHALL provide a single `process` tool that handles both command execution and process lifecycle management through an `action` parameter. The tool SHALL support the following actions: `start`, `wait`, `kill`, `log`, `write`, `pause`, `resume`, `list`.

#### Scenario: Start action launches a command
- **WHEN** the `process` tool is called with `action: "start"` and `command: "ls -la"`
- **THEN** the system executes the command and returns the result (foreground) or PID (background)

#### Scenario: Start action with background flag
- **WHEN** the `process` tool is called with `action: "start"`, `command: "sleep 60"`, and `background: true`
- **THEN** the system starts the process in background mode, captures stdout/stderr via piped streams, registers the PID in the tracker, and returns the PID

#### Scenario: Log action returns captured output
- **WHEN** the `process` tool is called with `action: "log"` and a valid `processId`
- **THEN** the system returns the captured stdout and stderr from the process

#### Scenario: List action shows all processes
- **WHEN** the `process` tool is called with `action: "list"`
- **THEN** the system returns a JSON array of all tracked processes with pid, command, status, and uptime

### Requirement: Background process stdio capture
The system SHALL spawn background processes with `stdio: ["ignore", "pipe", "pipe"]` to capture stdout and stderr. The captured output SHALL be stored in the processTracker entry and retrievable via the `log` action.

#### Scenario: Background process captures stdout
- **WHEN** a background process is started with `action: "start"`, `command: "echo hello"`, and `background: true`
- **THEN** the captured stdout contains "hello" and is retrievable via `action: "log"`

#### Scenario: Background process captures stderr
- **WHEN** a background process is started with `action: "start"`, `command: "echo error >&2"`, and `background: true`
- **THEN** the captured stderr contains "error" and is retrievable via `action: "log"`

### Requirement: Process lifecycle actions
The system SHALL support `wait`, `kill`, `write`, `pause`, and `resume` actions on tracked processes.

#### Scenario: Wait action blocks until process exits
- **WHEN** the `process` tool is called with `action: "wait"` and a valid `processId`
- **THEN** the system blocks until the process exits and returns the exit status

#### Scenario: Kill action terminates process
- **WHEN** the `process` tool is called with `action: "kill"` and a valid `processId`
- **THEN** the system sends SIGTERM, waits 5 seconds, then sends SIGKILL if unresponsive

#### Scenario: Write action sends data to stdin
- **WHEN** the `process` tool is called with `action: "write"`, a valid `processId`, and `data: "input"`
- **THEN** the system writes the data to the process's stdin

#### Scenario: Pause action stops process
- **WHEN** the `process` tool is called with `action: "pause"` and a valid `processId`
- **THEN** the system sends SIGSTOP and updates status to "paused"

#### Scenario: Resume action restarts process
- **WHEN** the `process` tool is called with `action: "resume"` and a valid `processId`
- **THEN** the system sends SIGCONT and updates status to "running"

### Requirement: Input validation
The system SHALL validate all inputs using Zod schemas. The `action` parameter SHALL be restricted to the enum values: `start`, `wait`, `kill`, `log`, `write`, `pause`, `resume`, `list`. The `command` parameter is required only for `start` action. The `processId` parameter is required for all actions except `start` and `list`.

#### Scenario: Invalid action rejected
- **WHEN** the `process` tool is called with `action: "invalid"`
- **THEN** the system returns a Zod validation error

#### Scenario: Missing command on start
- **WHEN** the `process` tool is called with `action: "start"` but no `command`
- **THEN** the system returns a validation error

#### Scenario: Missing processId on log
- **WHEN** the `process` tool is called with `action: "log"` but no `processId`
- **THEN** the system returns an error: "processId is required for this action"

## REMOVED Requirements

### Requirement: Separate shell tool
**Reason**: Replaced by unified process tool with `start` action
**Migration**: Use `process` tool with `action: "start"` and `command` parameter instead of `shell` tool

### Requirement: Separate process tool with poll action
**Reason**: The `poll` action is redundant with `list` and `wait`. The unified tool replaces the old process tool schema.
**Migration**: Use `list` action for process visibility, `wait` action for blocking on exit