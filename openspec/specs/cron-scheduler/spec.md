## Requirements

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

### Requirement: Init-time Crontab Synchronization
The system SHALL automatically synchronize persisted job definitions from `memory/schedules/*.json` with the system crontab block on every container initialization, before the scheduler begins processing. The sync reconciles added, removed, updated, and paused jobs without interrupting any currently executing crond jobs.

#### Scenario: Sync runs on container init
- **WHEN** the application starts with `scheduler.syncOnInit` enabled (default `true`)
- **THEN** the system reads all JSON files from `memory/schedules/`, compares them against the current crontab block, and writes a reconciled block back

#### Scenario: New jobs are added to crontab
- **WHEN** a JSON file exists in `memory/schedules/` for a job not present in the crontab block
- **THEN** the system adds the job entry to the crontab block

#### Scenario: Removed jobs are deleted from crontab
- **WHEN** a job entry exists in the crontab block but no corresponding JSON file exists in `memory/schedules/`
- **THEN** the system removes the job entry from the crontab block

#### Scenario: Updated jobs are refreshed in crontab
- **WHEN** a job exists in both the crontab block and `memory/schedules/` but with differing cron expression or command
- **THEN** the system updates the crontab entry to match the JSON file

#### Scenario: Paused jobs are excluded from crontab
- **WHEN** a job has `enabled: false` in its JSON file
- **THEN** the system does not include the job in the crontab block and removes any existing entry

#### Scenario: No job duplication during sync
- **WHEN** the sync function writes the crontab
- **THEN** the system replaces the entire madz-schedules block rather than appending entries

#### Scenario: Sync does not interrupt running jobs
- **WHEN** the sync function executes
- **THEN** it performs only crontab read/write operations — no process signals are sent to crond or running jobs

#### Scenario: Sync can be disabled via config
- **WHEN** `scheduler.syncOnInit` is set to `false` in config
- **THEN** the system skips the init-time crontab synchronization
