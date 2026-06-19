# system-logger Specification

## Purpose
TBD - created by archiving change system-logger-pino. Update Purpose after archive.
## Requirements
### Requirement: Pino is added as a project dependency
The project SHALL include `pino` as a production dependency in `package.json`.

#### Scenario: Package installed
- **WHEN** running `npm install` with the updated `package.json`
- **THEN** `pino` is resolved and importable via `import pino from "pino"`

### Requirement: Logger module exports structured logging methods
The `src/logger.js` module SHALL export `logger` with methods `info`, `warn`, `error`, `debug`, and `fatal`. Each method accepts a message string and an optional structured data object.

#### Scenario: Info method writes to logger
- **WHEN** `logger.info("startup")` is called
- **THEN** a structured JSON log entry is written to the info log file

#### Scenario: Error method writes to logger
- **WHEN** `logger.error("crash", { err: someError })` is called
- **THEN** a structured JSON log entry is written to both the info log file and the error log file

#### Scenario: Warn method writes to logger
- **WHEN** `logger.warn("deprecation notice")` is called
- **THEN** a structured JSON log entry is written to the info log file

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

### Requirement: Dual file output
The logger SHALL produce two log files:
- `madz.log`: captures `info`, `warn`, `debug`, `trace`, `fatal`, and `error` levels
- `madz_error.log`: captures only `error` and `fatal` levels

#### Scenario: Error appears in both files
- **WHEN** `logger.error("something failed")` is called
- **THEN** the entry appears in both `madz.log` and `madz_error.log`

#### Scenario: Fatal appears in both files
- **WHEN** `logger.fatal("critical failure")` is called
- **THEN** the entry appears in both `madz.log` and `madz_error.log`

#### Scenario: Info only in info file
- **WHEN** `logger.info("startup complete")` is called
- **THEN** the entry appears only in `madz.log`, not in `madz_error.log`

### Requirement: Log directory is created automatically
The logger SHALL create the log directory recursively if it does not exist.

#### Scenario: Directory does not exist
- **WHEN** the logger is initialized and the log directory path does not exist
- **THEN** the directory is created with `mkdirSync({ recursive: true })`

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

### Requirement: Silent mode in tests
The logger SHALL produce no output when `process.env.NODE_ENV === "test"`.

#### Scenario: Tests run with logger
- **WHEN** tests import `logger` and call any method
- **THEN** no log lines are written to any file

### Requirement: Logger flushes on shutdown
The shutdown handler in `src/session/shutdown.js` SHALL call `logger.flush()` before process exit to ensure all buffered log entries are written.

#### Scenario: Logger flushes during graceful shutdown
- **WHEN** the application receives a shutdown signal (SIGTERM/SIGINT)
- **THEN** `logger.flush()` is called before the process exits
- **AND** all buffered log entries are written to the log files

#### Scenario: Logger flushes during chat mode exit
- **WHEN** the CLI is invoked with `--chat` and completes
- **THEN** `logger.flush()` is called before `process.exit(0)`

### Requirement: No console.* in production code
All `src/` files SHALL replace `console.log`, `console.warn`, and `console.error` with calls to `logger.info`, `logger.warn`, and `logger.error` respectively.

#### Scenario: Console removed from shutdown
- **WHEN** reviewing `src/session/shutdown.js`
- **THEN** no `console.error` calls remain; `logger.error` is used instead

#### Scenario: Console removed from scheduler
- **WHEN** reviewing `src/scheduler/autoSchedule.js`
- **THEN** no `console.warn` calls remain; `logger.warn` is used instead

#### Scenario: Console removed from tools
- **WHEN** reviewing `src/tools/cron.js`
- **THEN** no `console.warn` calls remain; `logger.warn` is used instead

#### Scenario: Console removed from gc
- **WHEN** reviewing `src/memory/gc.js`
- **THEN** no `console.warn` calls remain; `logger.warn` is used instead

### Requirement: CLI output preserved
The `index.js` file SHALL retain `console.log` and `console.error` only for intentional CLI user output (e.g., `--json` mode, direct chat response text, and TUI rendering).

#### Scenario: --json output preserved
- **WHEN** the CLI is invoked with `--json`
- **THEN** the JSON response is written to stdout via `console.log`

#### Scenario: Chat output preserved
- **WHEN** the CLI is invoked in `--mode chat` mode
- **THEN** the assistant response body is written to stdout via `console.log`

