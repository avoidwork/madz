# Spec Delta

## MODIFIED Requirements

### Requirement: Unified process tool with action-based routing
The system SHALL provide a single `process` tool that handles both command execution and process lifecycle management through an `action` parameter. The tool SHALL support the following actions: `start`, `wait`, `kill`, `log`, `write`, `pause`, `resume`, `list`. The tool SHALL return a native structured object on every path: `{ ok: true, ... }` on success and `{ ok: false, error: ... }` on failure.

#### Scenario: Start action launches a command
- **WHEN** the `process` tool is called with `action: "start"` and `command: "ls -la"`
- **THEN** the system executes the command and returns `{ ok: true, exitCode, stdout, stderr }` (foreground) or `{ ok: true, pid, command }` (background)

#### Scenario: Start action with background flag
- **WHEN** the `process` tool is called with `action: "start"`, `command: "sleep 60"`, and `background: true`
- **THEN** the system starts the process in background mode, captures stdout/stderr via piped streams, registers the PID in the tracker, and returns `{ ok: true, pid, command }`

#### Scenario: Log action returns captured output
- **WHEN** the `process` tool is called with `action: "log"` and a valid `processId`
- **THEN** the system returns `{ ok: true, stdout, stderr }` with the captured output from the process

#### Scenario: List action shows all processes
- **WHEN** the `process` tool is called with `action: "list"`
- **THEN** the system returns `{ ok: true, entries: [...] }` where `entries` is an array of all tracked processes with pid, command, status, and uptime

#### Scenario: Error paths return structured failure
- **WHEN** the `process` tool is called with an invalid action, a missing required field, or a non-existent processId
- **THEN** the system returns `{ ok: false, error: "<message>" }` with a descriptive error message
