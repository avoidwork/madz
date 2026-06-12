## ADDED Requirements

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

### Requirement: Dual file output
The logger SHALL produce two log files:
- `madz.log`: captures `info`, `warn`, `debug`, `trace`, `fatal`, and `error` levels
- `madz_error.log`: captures only `error` level

#### Scenario: Error appears in both files
- **WHEN** `logger.error("something failed")` is called
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

#### Scenario: Log directory is immutable
- **WHEN** the log directory is set to an immutable path (e.g., `/root-locked/`)
- **THEN** the logger initializes without throwing and no log entries are written

### Requirement: Silent mode in tests
The logger SHALL produce no output when `process.env.NODE_ENV === "test"`.

#### Scenario: Tests run with logger
- **WHEN** tests import `logger` and call any method
- **THEN** no log lines are written to any file

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
