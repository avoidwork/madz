## ADDED Requirements

### Requirement: Cron Expression Parsing
The system SHALL parse 5-field cron expressions (`minute hour day-of-month month day-of-week`) for scheduling skill executions. The system MUST validate cron expressions at load time and reject invalid expressions with a structured error: `{ error: "invalid-cron-expression", expression: "<expr>" }`. The system MUST support `*` (any value), literal numbers, comma-separated lists (`1,3,5`), ranges (`1-5`), and step values (`*/5`).

#### Scenario: Valid cron expression parses correctly
- **WHEN** a schedule entry contains expression `0 */2 * * *` (every 2 hours at minute 0)
- **THEN** the parser validates it as valid and stores the parsed tokenized representation

#### Scenario: Invalid cron expression is rejected
- **WHEN** a schedule entry contains expression `60 * * * *` (minute 60 is invalid)
- **THEN** the parser rejects it with `{ error: "invalid-cron-expression", expression: "60 * * * *" }`

#### Scenario: Cron step values parse correctly
- **WHEN** a schedule entry contains expression `*/15 * * * *` (every 15 minutes)
- **THEN** the parser tokenizes it into matching values at minutes 0, 15, 30, 45

### Requirement: Scheduler Tick Loop
The system SHALL start an in-process timer that fires every `settings.scheduler.checkInterval` milliseconds (default 60000ms). On each tick, the system MUST compare the current time against all cron expressions and queue any matching job for execution. The system MUST skip ticks if `settings.scheduler.enabled` is `false`. The system MUST NOT block the event loop during the tick check.

#### Scenario: Scheduler fires on every check interval
- **WHEN** the scheduler is running with `checkInterval: 60000`
- **THEN** it evaluates all cron expressions against the current time every 60 seconds

#### Scenario: Scheduler respects enabled flag
- **WHEN** `settings.scheduler.enabled` is `false` at startup
- **THEN** the scheduler does not start the tick loop and does not evaluate cron expressions

#### Scenario: Scheduler tick does not block event loop
- **WHEN** the scheduler evaluates cron expressions
- **THEN** the evaluation completes within a bounded time and does not prevent other event loop processing

### Requirement: Scheduled Job Execution
When a cron expression matches the current time, the system MUST create a background session for the scheduled skill. The execution MUST resolve the skill by name, inject its instructions into the system message, run tool invocations through the tool registry, and persist results to the memory directory. The background session MUST have its own session ID distinct from user-facing sessions.

#### Scenario: Scheduled skill executes via background session
- **WHEN** a cron expression matches the current time for a skill named `daily-report`
- **THEN** the system creates a background session, resolves the `daily-report` skill, injects its instructions, and processes it

#### Scenario: Scheduled execution uses the same tool and sandbox system
- **WHEN** a scheduled skill invokes tools
- **THEN** the tools execute through the standard tool registry with sandbox enforcement, validation, and logging

#### Scenario: Scheduled session has its own ID
- **WHEN** a scheduled job executes
- **THEN** the system assigns a unique session ID following the naming convention `<date>-scheduled-<skill-id>-<timestamp>`

### Requirement: Concurrency Limits
The scheduler MUST enforce `settings.scheduler.maxConcurrent` to limit how many jobs execute at the same time. If the number of active jobs equals the limit, new matching jobs MUST be queued (default policy) or skipped (configurable via `settings.scheduler.overflowPolicy: "queue" | "skip"`). The default policy is `queue`. Overdue jobs (running longer than `settings.scheduler.maxDurationPerSkill` milliseconds) MUST be terminated and marked as `failed` with reason `"timeout"`.

#### Scenario: Job queued when concurrency limit reached
- **WHEN** `maxConcurrent` is 2 and 2 jobs are already running
- **THEN** a new matching job is added to the queue and executes when a running job completes

#### Scenario: Job skipped instead of queued
- **WHEN** `settings.scheduler.overflowPolicy` is `skip`
- **THEN** a new matching job is silently discarded when concurrency limit is reached, with a log entry `"scheduler: overflow, skipped job for <skill-id>"`

#### Scenario: Long-running job is terminated by timeout
- **WHEN** a job runs longer than `settings.scheduler.maxDurationPerSkill` (e.g., 300000ms = 5 minutes)
- **THEN** the scheduler terminates the job (kills the background session), marks it as `failed` with reason `"timeout"`, and logs the event

### Requirement: Scheduler State Persistence
The scheduler MUST persist its state (cron expressions, scheduled times, current execution status) to `.madz-scheduler.json` in the project root on every state change. On application restart, the system MUST load this file and resume the cron tick evaluation with all previously registered schedules. If the file does not exist, the scheduler starts empty.

#### Scenario: Scheduler state is persisted on schedule registration
- **WHEN** a user adds a new cron schedule via command
- **THEN** the `.madz-scheduler.json` file is updated with the new schedule entry

#### Scenario: Scheduler resumes on restart
- **WHEN** the application starts and `.madz-scheduler.json` exists
- **THEN** the system loads all schedules and begins tick evaluation with the previously registered cron expressions

#### Scenario: Scheduler handles missing state file gracefully
- **WHEN** the application starts and `.madz-scheduler.json` does not exist
- **THEN** the scheduler starts with an empty schedule and does not produce an error

### Requirement: Scheduled Execution Logging
Every scheduled execution MUST produce a structured log entry containing: `scheduler: true`, `skill_id`, `cron_expression`, `scheduled_at` (ISO timestamp), `started_at` (ISO timestamp), `completed_at` (ISO timestamp, if completed), `status` (`success`, `failed`, `timeout`, `skipped`), and `error` (if failed). The log entry MUST be written to the same log target as tool logs (stdout/file per settings).

#### Scenario: Successful execution logs with completion time
- **WHEN** a scheduled skill completes successfully
- **THEN** a log entry is written with `status: "success"` and `completed_at` timestamp

#### Scenario: Scheduled skill failure is logged
- **WHEN** a scheduled skill fails (e.g., tool error, skill validation failure)
- **THEN** a log entry is written with `status: "failed"`, the error message, and `completed_at` timestamp

#### Scenario: Overdue job logs timeout failure
- **WHEN** a scheduled skill exceeds `maxDurationPerSkill`
- **THEN** a log entry is written with `status: "timeout"` and `error: "execution exceeded max duration"`

### Requirement: Scheduler Commands
The system SHALL provide the following TUI commands for scheduler management:
- `/schedule add <skill-id> "<cron-expression>"` — add a new scheduled job
- `/schedule remove <skill-id>` — remove the most recent schedule matching the skill
- `/schedule list` — display all registered schedules with their cron expressions and status
- `/schedule status` — display scheduler status: enabled/disabled, checkInterval, maxConcurrent, activeJobs, queuedJobs

#### Scenario: User adds a new scheduled job
- **WHEN** the user sends `/schedule add daily-report "0 9 * * *"`
- **THEN** the system validates the cron expression, creates the schedule entry, logs the addition, and persists state

#### Scenario: User lists all schedules
- **WHEN** the user sends `/schedule list`
- **THEN** the system displays a table of all registered schedules: skill name, cron expression, next run time, last status

#### Scenario: Scheduler status shows current state
- **WHEN** the user sends `/schedule status`
- **THEN** the system displays scheduler state: enabled, checkInterval, maxConcurrent, activeJobCount, queuedJobCount

### Requirement: Scheduler TUI Status
The TUI status bar SHALL display scheduler health: `scheduler: idle` when no jobs are running, `scheduler: X active / Y queued` when jobs are active, or `scheduler: disabled` when disabled by settings. The indicator MUST update in real-time as the scheduler tick loop executes.

#### Scenario: Status bar shows scheduler disabled
- **WHEN** `settings.scheduler.enabled` is `false`
- **THEN** the status bar displays `scheduler: disabled`

#### Scenario: Status bar shows active scheduled jobs
- **WHEN** the scheduler has 2 active jobs and 1 queued
- **THEN** the status bar displays `scheduler: 2 active / 1 queued`

#### Scenario: Status bar shows scheduler idle
- **WHEN** no jobs are active or queued
- **THEN** the status bar displays `scheduler: idle`
