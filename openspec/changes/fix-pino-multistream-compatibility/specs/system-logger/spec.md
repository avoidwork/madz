## MODIFIED Requirements

### Requirement: Dual file output
The logger SHALL produce two log files:
- `madz.log`: captures `info`, `warn`, `debug`, and `trace` levels
- `madz_error.log`: captures `error` and `fatal` levels

With the pino v10 array-based destination API, each log level routes to streams matching that level or higher. Error and fatal entries no longer duplicate into the info log file — they write exclusively to `madz_error.log`. This is the more correct behavior for a dedicated error log.

#### Scenario: Error appears only in error file
- **WHEN** `logger.error("something failed")` is called
- **THEN** the entry appears only in `madz_error.log`, not in `madz.log`

#### Scenario: Fatal appears only in error file
- **WHEN** `logger.fatal("critical failure")` is called
- **THEN** the entry appears only in `madz_error.log`, not in `madz.log`

#### Scenario: Info only in info file
- **WHEN** `logger.info("startup complete")` is called
- **THEN** the entry appears only in `madz.log`, not in `madz_error.log`