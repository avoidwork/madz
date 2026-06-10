## ADDED Requirements

### Requirement: Cron Job Sync to System Crontab
The system SHALL register cron jobs into the user's system crontab via the `Cron` module, using the `# --- BEGIN madz-schedules ---` / `# --- END madz-schedules ---` block delimiters. Jobs are created by the `cronjob` tool and stored as JSON files in `memory/schedules/`.

#### Scenario: New job registered to crontab
- **WHEN** the `cronjob` tool creates a new job
- **THEN** `Cron.add(job)` is called to write the entry into the crontab block

#### Scenario: Removed job deleted from crontab
- **WHEN** the `cronjob` tool removes a job
- **THEN** `Cron.remove(name)` is called to delete the entry from the crontab block

#### Scenario: Non-madz crontab entries preserved
- **WHEN** `Cron.add()` or `Cron.remove()` modifies the crontab block
- **THEN** all lines outside the madz-schedules block are preserved unchanged
