## ADDED Requirements

### Requirement: Create action derives command from skill name
The cron tool's `create` action SHALL derive a command from the skill name when a job is created with only a `skill` and no explicit `command`. The derived command SHALL be `cd ${process.cwd()} && node index.js --message "Run the ${skill} skill"`, mirroring `ScheduleManager.loadFromDisk`. The derived command SHALL be stored on the job so it persists to disk and SHALL be passed to `cronModule.add`.

#### Scenario: Create job with only skill derives command
- **WHEN** the user creates a job with `name`, `cron`, and `skill` but no `command`
- **THEN** the job is persisted with a `command` derived from the skill name
- **THEN** the derived command is passed to `cronModule.add`
- **THEN** the job's `command` field is set to `cd ${process.cwd()} && node index.js --message "Run the ${skill} skill"`

#### Scenario: Create job with explicit command uses it directly
- **WHEN** the user creates a job with `name`, `cron`, and an explicit `command`
- **THEN** the job is persisted with the explicit command unchanged
- **THEN** the explicit command is passed to `cronModule.add`
