## ADDED Requirements

### Requirement: Cron Job Sync to System Crontab
When the `cronjob` tool creates a new scheduled job, the system SHALL register a corresponding entry in the user's system crontab. When a job is removed, the system SHALL delete the corresponding crontab entry. Jobs are stored as JSON files in `memory/schedules/`.

#### Scenario: New job registered to crontab
- **WHEN** the `cronjob` tool creates a new job with a cron schedule
- **THEN** a matching cron entry is added to the user's system crontab inside the madz-managed block

#### Scenario: Removed job deleted from crontab
- **WHEN** the `cronjob` tool removes a job
- **THEN** the corresponding crontab entry is deleted from the user's system crontab

#### Scenario: Non-madz crontab entries preserved
- **WHEN** the system adds or removes a crontab entry
- **THEN** all existing crontab lines outside the madz-managed block are preserved unchanged
