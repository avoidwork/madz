## ADDED Requirements

### Requirement: Sync accepts skill-only jobs
The system SHALL accept job definitions that have a `skill` field instead of a `command` field when reading jobs from disk during crontab sync. For such jobs, the command SHALL be derived from the skill name as `cd ${process.cwd()} && node index.js --message "Run the ${skill} skill"`, mirroring `ScheduleManager.loadFromDisk`. Skill-only jobs SHALL NOT be silently skipped during sync.

#### Scenario: Skill-only job is included in sync
- **WHEN** a JSON file in `memory/schedules/` contains `name`, `cron`, and `skill` but no `command`
- **THEN** the job is read from disk and included in the crontab sync
- **THEN** the job's command is derived from the skill name as `cd ${process.cwd()} && node index.js --message "Run the ${skill} skill"`

#### Scenario: Job with explicit command is still read normally
- **WHEN** a JSON file in `memory/schedules/` contains `name`, `cron`, and `command`
- **THEN** the job is read from disk with the explicit command unchanged

#### Scenario: Job missing both skill and command is skipped
- **WHEN** a JSON file in `memory/schedules/` contains `name` and `cron` but neither `skill` nor `command`
- **THEN** the job is skipped during sync
