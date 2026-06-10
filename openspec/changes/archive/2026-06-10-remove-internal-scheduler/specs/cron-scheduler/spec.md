## REMOVED Requirements

### Requirement: Declarative Schedule Configuration
**Reason**: The `schedules` section in `config.yaml` is being removed. Jobs are now managed entirely through the `cronjob` tool with crontab-driven scheduling instead of in-process queueing.
**Migration**: Use the `cronjob` tool (`action: "create"`) to define and manage scheduled jobs.

### Requirement: Concurrency Limits
**Reason**: Jobs are now managed by the host crontab daemon and run directly. The internal scheduler's `ScheduleQueue` is removed.
**Migration**: Concurrency is no longer managed by madz — the host crontab handles scheduling independently.

## MODIFIED Requirements

### Requirement: Schedule Management Commands
The system SHALL expose TUI commands for interacting with the scheduler: `:schedule list`, `:schedule pause <name>`, `:schedule resume <name>`, and `:schedule run-now <name>`. Scheduled jobs are now stored as JSON files in `memory/schedules/` and managed via the `cronjob` tool rather than from a config.yaml section or in-process schedule registry.

#### Scenario: User lists active schedules
- **WHEN** the user types `:schedule list`
- **THEN** the system displays all jobs stored in `memory/schedules/` with their status and next run times

#### Scenario: User runs a schedule manually
- **WHEN** the user types `:schedule run-now daily-report`
- **THEN** the system immediately executes the `daily-report` job and logs the result

## ADDED Requirements

### Requirement: Cron Job Sync to System Crontab
When the `cronjob` tool creates a new scheduled job, the system SHALL register a corresponding entry in the user's system crontab. When a job is removed via `cronjob`, the system SHALL delete the corresponding crontab entry. Jobs are stored as JSON files in `memory/schedules/`.

#### Scenario: New job registered to crontab
- **WHEN** the `cronjob` tool creates a new job with a cron schedule
- **THEN** a matching cron entry is added to the user's system crontab inside the madz-managed block

#### Scenario: Removed job deleted from crontab
- **WHEN** the `cronjob` tool removes a job
- **THEN** the corresponding crontab entry is deleted from the user's system crontab

#### Scenario: Non-madz crontab entries preserved
- **WHEN** the system adds or removes a crontab entry
- **THEN** all existing crontab lines outside the madz-managed block are preserved unchanged
