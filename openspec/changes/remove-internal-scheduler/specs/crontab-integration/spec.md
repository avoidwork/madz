## ADDED Requirements

### Requirement: Schedule Sync to System Crontab
The system SHALL write all schedule entries (both config.yaml-defined and agent-created via the `cronjob` tool) into the user's system crontab via the `CronInstaller` module, using the `# --- BEGIN madz-schedules ---` / `# --- END madz-scores ---` block delimiters.

#### Scenario: Config.yaml schedules installed at startup
- **WHEN** the app starts with schedules defined in `config.yaml`
- **THEN** `CronInstaller.install()` is called to write them into the system crontab within the madz-schedules block

#### Scenario: Agent-created schedule synced to crontab
- **WHEN** the `cronjob` tool creates a new job
- **THEN** `CronInstaller.install()` is called with the merged list of config.yaml schedules and all JSON schedule files, ensuring the new job appears in the system crontab

#### Scenario: Agent-updated schedule synced to crontab
- **WHEN** the `cronjob` tool updates, pauses, resumes, or removes a job
- **THEN** `CronInstaller.install()` is called afterward with the updated merged schedule list reflecting the change

#### Scenario: Non-madz crontab entries preserved
- **WHEN** `CronInstaller.install()` writes the madz-schedules block
- **THEN** all lines outside the madz-schedules block are preserved unchanged

#### Scenario: Paused schedules excluded from crontab
- **WHEN** a schedule is paused (via `cronjob` tool or config)
- **THEN** it is omitted from the crontab entries written by `CronInstaller.install()`
