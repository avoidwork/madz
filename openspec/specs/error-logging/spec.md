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

