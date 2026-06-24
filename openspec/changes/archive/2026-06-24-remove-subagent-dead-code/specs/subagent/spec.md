## ADDED Requirements

### Requirement: Child process environment
The subAgent tool SHALL pass only necessary environment variables to child processes. No unused or dead environment variables SHALL be included in the child process environment.

#### Scenario: Child process receives necessary env vars
- **WHEN** a sub-agent is spawned
- **THEN** it inherits the parent process's environment variables (API keys, config paths) without unused variables like MADZ_SESSION_ID

#### Scenario: No dead env vars passed to child
- **WHEN** a sub-agent is spawned
- **THEN** the child process environment does not include MADZ_SESSION_ID

## MODIFIED Requirements

### Requirement: Timeout enforcement
The subAgent tool SHALL enforce timeouts with priority: per-call `timeout` parameter > `config.yaml` default.

#### Scenario: Per-call timeout overrides config
- **WHEN** subAgent is called with timeout 30000 and config default is 60000
- **THEN** the sub-agent uses 30000ms timeout

#### Scenario: Config default is used when no per-call override
- **WHEN** no per-call timeout is provided and config.yaml defines process.subAgent.timeout as 600000
- **THEN** the sub-agent uses 600000ms timeout

#### Scenario: Timeout kills process
- **WHEN** sub-agent exceeds its timeout
- **THEN** the process receives SIGTERM, then SIGKILL after 5 seconds

### Requirement: Configuration
The subAgent tool SHALL be configured via `config.yaml` under `process.subAgent` with settings for timeout, maxConcurrent, sessionMode, defaultStrategy, and defaultOnError.

#### Scenario: Config section exists
- **WHEN** config.yaml is loaded
- **THEN** `process.subAgent` section contains timeout, maxConcurrent, sessionMode, defaultStrategy, defaultOnError

#### Scenario: Config defaults are applied
- **WHEN** no per-call overrides are provided
- **THEN** config defaults are used for timeout, maxConcurrent, sessionMode, defaultStrategy, defaultOnError