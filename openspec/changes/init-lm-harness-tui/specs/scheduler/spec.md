## ADDED Requirements

### Requirement: Declarative schedule configuration
The system SHALL accept schedule definitions declared in `config.yaml` using standard cron expressions mapped to registered skill names and optional parameters.

#### Scenario: Schedule registered from config
- **WHEN** `config.yaml.schedules` contains an entry with a valid cron expression and skill reference
- **THEN** the scheduler registers the schedule and computes the next execution time from the cron expression

#### Scenario: Invalid cron expression rejected
- **WHEN** a schedule entry contains a cron expression that does not parse
- **THEN** the scheduler rejects the entry, logs an error with the offending schedule name, and continues with remaining entries

### Requirement: Time-based skill execution
The system SHALL execute registered schedules at the correct times, inheriting the harness's security boundaries and skill permissions.

#### Scenario: Schedule fires on time
- **WHEN** the current time matches a registered schedule's cron expression
- **THEN** the system invokes the target skill with its configured memory context and permission scope

#### Scenario: Scheduled execution respects sandbox
- **WHEN** a scheduled skill execution runs
- **THEN** it executes within the Docker sandbox with the same resource limits and network policies as a manual invocation

#### Scenario: Schedule with memory context
- **WHEN** a schedule entry specifies a `memory.context` reference
- **THEN** the system loads the specified memory file and injects its content as context into the skill invocation

### Requirement: Execution result logging
The system SHALL log the results of all scheduled executions to the markdown memory store.

#### Scenario: Success result logged
- **WHEN** a scheduled skill completes successfully
- **THEN** the system writes a summary entry to `memory/logs/` with the schedule name, execution time, duration, and output summary

#### Scenario: Failed execution logged
- **WHEN** a scheduled skill fails during execution
- **THEN** the system writes an error entry to `memory/logs/` with the schedule name, error message, and stack trace reference

### Requirement: Scheduler lifecycle management
The system SHALL support starting, stopping, and listing schedules via TUI commands and the programmatic API.

#### Scenario: List all schedules
- **WHEN** the user types `/schedule list` in the TUI
- **THEN** the system displays all registered schedules with their next execution time and status

#### Scenario: Enable/disable schedule
- **WHEN** the user types `/schedule enable <name>` or `/schedule disable <name>`
- **THEN** the system toggles the schedule's active state without removing it from the registry

#### Scenario: Schedule removed from config
- **WHEN** a schedule entry is removed from `config.yaml` and the config hot-reload triggers
- **THEN** the scheduler removes the schedule and logs the action
