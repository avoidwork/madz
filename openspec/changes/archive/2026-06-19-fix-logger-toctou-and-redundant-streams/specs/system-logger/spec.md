## MODIFIED Requirements

### Requirement: Log directory is OS-aware
The logger SHALL determine the log directory based on the operating system:
- Alpine Linux (Docker): `~/.cache/madz/logs/`
- Standard Linux: `~/.local/share/madz/logs/`
- macOS: `~/Library/Logs/madz/`
- Windows: `%LOCALAPPDATA%\madz\logs\`

The Alpine Linux detection via `/etc/alpine-release` MUST handle file deletion gracefully without throwing uncaught exceptions.

#### Scenario: Alpine detection
- **WHEN** `/etc/alpine-release` exists
- **THEN** the log directory is set to `~/.cache/madz/logs/`

#### Scenario: Standard Linux detection
- **WHEN** the system is Linux and `/etc/alpine-release` does not exist
- **THEN** the log directory is set to `~/.local/share/madz/logs/`

#### Scenario: macOS detection
- **WHEN** `process.platform === "darwin"`
- **THEN** the log directory is set to `~/Library/Logs/madz/`

#### Scenario: Windows detection
- **WHEN** `process.platform === "win32"`
- **THEN** the log directory is set to `%LOCALAPPDATA%\madz\logs\`

#### Scenario: Edge case - empty Alpine release file
- **WHEN** `/etc/alpine-release` exists but is empty
- **THEN** the log directory falls through to standard Linux path `~/.local/share/madz/logs/`

#### Scenario: Edge case - Alpine release file deleted between check and read
- **WHEN** `/etc/alpine-release` is deleted between the existence check and the read operation
- **THEN** the function catches the exception and falls through to standard Linux path `~/.local/share/madz/logs/` without throwing

#### Scenario: Edge case - Alpine release file unreadable
- **WHEN** `/etc/alpine-release` exists but cannot be read (permission denied)
- **THEN** the function catches the exception and falls through to standard Linux path `~/.local/share/madz/logs/` without throwing

### Requirement: Graceful fallback on write errors
The logger SHALL not crash if the log directory is unwritable.

When both primary log streams fail, the logger SHALL create a single `/dev/null` stream and reuse it for both info and error fallback, rather than creating separate streams.

#### Scenario: Log directory is unwritable
- **WHEN** the log directory is set to an unwritable path (e.g., `/root-locked/`)
- **THEN** the logger initializes without throwing, falls back to `os.tmpdir()`, and no log entries are written to the original path

#### Scenario: Fallback directory is also unwritable
- **WHEN** both the primary and fallback directories are unwritable
- **THEN** the logger initializes without throwing and silently discards all log entries using a single `/dev/null` stream

#### Scenario: Single devNull stream reuse
- **WHEN** both info and error primary streams fail and fallback to `/dev/null`
- **THEN** only one `/dev/null` stream is created and reused for both info and error output