# crontab-sync Specification

## Purpose
TBD - created by archiving change sync-crond-on-init. Update Purpose after archive.
## Requirements
### Requirement: Init-time crontab synchronization
The system SHALL synchronize persisted job definitions from `memory/schedules/*.json` with the system crontab block (`# --- BEGIN madz-schedules ---`) on every container initialization, before the scheduler begins processing.

#### Scenario: Sync runs on container init
- **WHEN** the application starts with `scheduler.syncOnInit` enabled (default)
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

### Requirement: No job duplication during sync
The system SHALL ensure that no job entry appears more than once in the crontab block after synchronization.

#### Scenario: Full block replacement prevents duplicates
- **WHEN** the sync function writes the crontab
- **THEN** the system replaces the entire madz-schedules block rather than appending entries

#### Scenario: Repeated syncs produce identical crontab
- **WHEN** the sync function is called multiple times with no changes to job definitions
- **THEN** the crontab block remains unchanged after the second call

### Requirement: No interruption of running jobs
The system SHALL not send signals to, kill, or otherwise interrupt any crond-managed processes during synchronization.

#### Scenario: Sync only modifies crontab file
- **WHEN** the sync function executes
- **THEN** it performs only crontab read/write operations — no process signals are sent

#### Scenario: crond picks up changes on next scan
- **WHEN** the sync writes a new crontab block
- **THEN** the running crond daemon detects changes on its next minute-level scan and schedules updated jobs accordingly

### Requirement: Configurable sync behavior
The system SHALL expose a configuration flag `scheduler.syncOnInit` (default `true`) that controls whether the init-time sync runs.

#### Scenario: Sync enabled by default
- **WHEN** the application starts without an explicit `scheduler.syncOnInit` setting
- **THEN** the sync runs on container init

#### Scenario: Sync can be disabled
- **WHEN** `scheduler.syncOnInit` is set to `false` in config
- **THEN** the system skips the init-time crontab synchronization

### Requirement: Sync logging
The system SHALL log the sync operation results at info level, including counts of added, removed, updated, and skipped jobs.

#### Scenario: Sync logs summary on completion
- **WHEN** the sync completes successfully
- **THEN** the system logs a summary message indicating how many jobs were added, removed, updated, and skipped

#### Scenario: Sync logs error on failure
- **WHEN** the sync fails (e.g., crontab write error)
- **THEN** the system logs the error at warn level and continues startup

