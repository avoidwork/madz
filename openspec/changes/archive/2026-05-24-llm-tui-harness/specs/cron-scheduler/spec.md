## ADDED Requirements

### Requirement: Declarative Schedule Configuration
The system SHALL read recurring task definitions from a `schedules` section in `config.yaml`, each specifying a cron expression, skill name, input parameters, and optional memory context file.

#### Scenario: User defines a daily health check schedule
- **WHEN** `config.yaml` contains a schedule entry with cron `0 9 * * *`, skill `host-info`, and input `{}`
- **THEN** the system registers a daily task that runs `host-info` at 09:00 local time

#### Scenario: Schedule uses valid cron expression
- **WHEN** `config.yaml` contains a schedule with a syntactically invalid cron expression
- **THEN** the system logs a configuration error and skips the schedule without crashing

### Requirement: Deterministic Sandbox Execution
Each scheduled execution SHALL run within the same sandbox isolation guarantees as user-initiated skill invocations, inheriting sandbox parameters, skill permissions, and memory context from the active session.

#### Scenario: Scheduled skill runs in a sandbox
- **WHEN** a scheduled task triggers at its configured time
- **THEN** the skill executes in a forked process with the configured memory isolation and network restrictions

#### Scenario: Scheduled run inherits memory context
- **WHEN** a schedule entry references a `context_file` in its config
- **THEN** the system loads the referenced memory file and prepends it to the skill's execution context

### Requirement: Concurrency Limits
The system SHALL enforce a maximum concurrent scheduled runs (default: 1) and queue additional runs when the limit is reached, processing them FIFO.

#### Scenario: Second scheduled run waits for first
- **WHEN** two daily schedules trigger at the same time but `max_concurrent` is 1
- **THEN** the second run is queued and begins after the first completes

### Requirement: Schedule Management Commands
The system SHALL expose TUI commands for interacting with the scheduler: `:schedule list`, `:schedule pause <name>`, `:schedule resume <name>`, and `:schedule run-now <name>`.

#### Scenario: User lists active schedules
- **WHEN** the user types `:schedule list`
- **THEN** the system displays all configured schedules with their next run times and enabled status

#### Scenario: User runs a schedule manually
- **WHEN** the user types `:schedule run-now daily-report`
- **THEN** the system immediately executes the `daily-report` schedule entry and logs the result

### Requirement: Schedule Results Logging
Every scheduled execution SHALL log its result as a markdown file in `memory/schedules/` with YAML frontmatter containing the schedule name, cron expression, start time, end time, exit status, and stdout/stderr output.

#### Scenario: Scheduled execution writes output to memory
- **WHEN** a scheduled skill completes
- **THEN** a markdown file is created in `memory/schedules/` documenting the run
