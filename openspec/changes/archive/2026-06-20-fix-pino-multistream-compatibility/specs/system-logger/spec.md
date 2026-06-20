## MODIFIED Requirements

### Requirement: Dual file output
The logger SHALL produce two log files:
- `madz.log`: captures `info`, `warn`, `debug`, `trace`, `error`, and `fatal` levels
- `madz_error.log`: captures `error` and `fatal` levels

With the pino v10 array-based destination API, each log level routes to streams matching that level or higher. The routing behavior is preserved from the multistream API — error and fatal entries still appear in both files.

#### Scenario: Error appears in both files
- **WHEN** `logger.error("something failed")` is called
- **THEN** the entry appears in both `madz.log` and `madz_error.log`

#### Scenario: Fatal appears in both files
- **WHEN** `logger.fatal("critical failure")` is called
- **THEN** the entry appears in both `madz.log` and `madz_error.log`

#### Scenario: Info only in info file
- **WHEN** `logger.info("startup complete")` is called
- **THEN** the entry appears only in `madz.log`, not in `madz_error.log`