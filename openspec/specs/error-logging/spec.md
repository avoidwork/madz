# error-logging Specification

## Purpose
TBD - created by archiving change replace-sync-fs-calls-and-silent-catches. Update Purpose after archive.
## Requirements
### Requirement: All catch blocks log errors
The system SHALL log all caught errors using the structured `logger` singleton from `src/logger.js`. No bare `catch {}` blocks are permitted per AGENTS.md §1.1.

#### Scenario: Expected failures use debug level
- **WHEN** a file not found error occurs during skill discovery
- **THEN** the catch block logs via `logger.debug()` with the error message

#### Scenario: Unexpected failures use error level
- **WHEN** a schedule execution fails unexpectedly
- **THEN** the catch block logs via `logger.error()` with the error message

#### Scenario: Silent catches are eliminated
- **WHEN** any file in the codebase has a `catch {}` block
- **THEN** it has been replaced with `catch (err) { logger.debug(...) }` or `catch (err) { logger.error(...) }`

### Requirement: Error logging preserves existing semantics
The system SHALL preserve existing error handling semantics — errors that were previously swallowed should still be handled gracefully, but now with logging. Errors that were previously re-thrown should continue to be re-thrown.

#### Scenario: Graceful degradation with logging
- **WHEN** `loadSystemPrompt()` fails to find the system prompt file
- **THEN** it logs the error and returns an empty string (same behavior as before, but now logged)

#### Scenario: Retention cleanup with logging
- **WHEN** `cleanRetainedMemory()` encounters a directory it cannot read
- **THEN** it logs the error and returns 0 (same behavior as before, but now logged)

### Requirement: Logger module catch blocks bind and log errors
The `src/shared/logger.js` module SHALL bind the error in every catch block and log it (at least at debug level) rather than silently discarding it. No bare `catch {}` blocks are permitted in the logger module per AGENTS.md §1.1. The logger MUST preserve its never-throw invariant — a logging failure inside a catch block MUST NOT propagate to the caller.

#### Scenario: Module-init stream creation failure logs at debug level
- **WHEN** `createWriteStream` fails while opening the info or error log file stream during module initialization
- **THEN** the catch block binds the error and logs it at debug level, and the module falls back to `/dev/null` or silent mode without throwing

#### Scenario: Directory creation failure logs at debug level
- **WHEN** `mkdirSync` fails while creating the log directory
- **THEN** the catch block binds the error and logs it at debug level, and the function returns `false` without throwing

#### Scenario: Logger method pino failure logs without recursion
- **WHEN** a pino log call inside a logger method (`info`, `warn`, `error`, `debug`, `fatal`) throws
- **THEN** the catch block binds the error and logs it via a non-recursive fallback (guarded `console.error`), and the method returns without throwing or re-invoking the logger singleton

#### Scenario: No bare catch blocks remain in logger module
- **WHEN** `src/shared/logger.js` is scanned for `catch {` patterns
- **THEN** no bare catch blocks are found — every catch block binds the error and logs it

