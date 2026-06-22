## ADDED Requirements

### Requirement: Sessions Directory Ensured at Init
The system SHALL create the sessions directory (`memory/sessions/`) exactly once during application initialization via `ensureSessionsDir()`. This function SHALL use `mkdir` with the recursive option to create the directory if it does not exist. If it already exists, the function SHALL return without error.

#### Scenario: Directory exists at init
- **WHEN** `ensureSessionsDir()` is called and `memory/sessions/` already exists
- **THEN** the function returns successfully without creating the directory

#### Scenario: Directory does not exist at init
- **WHEN** `ensureSessionsDir()` is called and `memory/sessions/` does not exist
- **THEN** the function creates the directory and returns successfully

### Requirement: SaveSession Is Pure Write
The `saveSession()` function SHALL NOT perform any filesystem checks or directory creation. It SHALL resolve the output path, build the session file content, and call `writeFile()` directly. If the underlying filesystem operation fails for any reason — including a missing directory, disk full, or permission error — the error SHALL propagate unhandled.

#### Scenario: Save succeeds when directory exists
- **WHEN** `saveSession()` is called after successful init
- **THEN** the function writes the session file and returns

#### Scenario: Save fails and crashes when directory is missing
- **WHEN** `saveSession()` is called and the sessions directory no longer exists
- **THEN** `writeFile()` throws an error
- **THEN** the error propagates and crashes the process

## MODIFIED Requirements

### Requirement: Session Shutdown and Cleanup
On session termination, the system SHALL flush all pending telemetry spans, close file handles on memory files, and write a final conversation state to `memory/`. The shutdown process SHALL treat `saveSession()` errors as fatal and exit with code 1. The process SHALL NOT silently ignore save failures.

#### Scenario: Session flushes telemetry on exit
- **WHEN** the user exits the TUI (`Ctrl+C` or `:quit`)
- **THEN** the system signals the OpenTelemetry provider to export all pending spans and waits for completion

#### Scenario: Session writes final memory state
- **WHEN** the session terminates
- **THEN** the system appends any remaining unsaved conversation exchanges to the latest memory file

#### Scenario: Save error during shutdown causes fatal exit
- **WHEN** the session terminates and `saveSession()` throws
- **THEN** the shutdown handler propagates the error and exits with code 1 instead of silently ignoring the failure
