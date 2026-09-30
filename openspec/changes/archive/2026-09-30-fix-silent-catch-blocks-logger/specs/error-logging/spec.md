## ADDED Requirements

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
