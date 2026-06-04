## ADDED Requirements

### Requirement: Sessions Directory Ensured at Init
The system SHALL call `ensureSessionsDir()` exactly once during application initialization. This function SHALL create the sessions directory (`memory/sessions/`) using `mkdir` with recursive option if it does not exist. If the directory already exists, the function SHALL return successfully without error.

#### Scenario: Directory exists at init
- **WHEN** `ensureSessionsDir()` is called and `memory/sessions/` already exists
- **THEN** the function returns successfully without creating a new directory

#### Scenario: Directory does not exist at init
- **WHEN** `ensureSessionsDir()` is called and `memory/sessions/` does not exist
- **THEN** the function creates the directory and returns successfully

## MODIFIED Requirements

### Requirement: Session Shutdown and Cleanup
On session termination, the system SHALL flush all pending telemetry spans, close file handles on memory files, and write a final conversation state to `memory/`. The system SHALL NOT silently create the sessions directory during save — if the directory is missing at save time, the save operation SHALL throw an error. The shutdown process SHALL treat save errors as fatal and exit with code 1.

The system SHALL also validate the sessions directory exists via `stat()` before every save operation. This validation occurs after init, once the directory has been ensured.

#### Scenario: Session flushes telemetry on exit
- **WHEN** the user exits the TUI (`Ctrl+C` or `:quit`)
- **THEN** the system signals the OpenTelemetry provider to export all pending spans and waits for completion

#### Scenario: Session writes final memory state
- **WHEN** the session terminates
- **THEN** the system appends any remaining unsaved conversation exchanges to the latest memory file

#### Scenario: Sessions directory exists during save
- **WHEN** `saveSession()` is called and the sessions directory exists
- **THEN** the system writes the session file successfully

#### Scenario: Sessions directory missing during save causes fatal error
- **WHEN** the sessions directory existed at init but was deleted before a save call
- **THEN** `saveSession()` throws a fatal error instead of silently creating the directory
- **THEN** the shutdown handler propagates the error and exits with code 1
