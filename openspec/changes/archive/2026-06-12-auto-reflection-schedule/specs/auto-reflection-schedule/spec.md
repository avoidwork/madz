## ADDED Requirements

### Requirement: Auto-detect first-time profile creation
The system SHALL detect when a `profile.md` file is created for the first time (i.e., no profile existed on disk before the save operation) and trigger automatic cron job registration.

#### Scenario: Detect first profile write
- **WHEN** `hasProfile()` returns `false` and `saveProfile()` is called
- **THEN** the system triggers the auto-schedule callback

#### Scenario: Skip on profile update
- **WHEN** `hasProfile()` returns `true` and `saveProfile()` is called
- **THEN** the system does NOT trigger the auto-schedule callback

#### Scenario: Handle detection failure gracefully
- **WHEN** the `hasProfile()` check throws an error
- **THEN** the system logs a warning and proceeds with the save without triggering auto-schedule

### Requirement: Auto-create daily reflection cron job
When a first-time profile is detected, the system SHALL automatically write a cron job definition to `memory/schedules/reflection-daily.json` with the following properties:
- `name`: `"reflection-daily"`
- `cron`: `"0 2 * * *"` (2am daily)
- `command`: `"cd /<cwd> && node index.js --chat \"/reflection\""` where `<cwd>` is the value of `process.cwd()` at the time of profile creation
- `enabled`: `true`

#### Scenario: Write job definition with correct name
- **WHEN** a first-time profile is created
- **THEN** a file `memory/schedules/reflection-daily.json` is created with `name: "reflection-daily"`

#### Scenario: Write job definition with 2am cron expression
- **WHEN** a first-time profile is created
- **THEN** the job definition contains `cron: "0 2 * * *"`

#### Scenario: Write job definition with working directory in command
- **WHEN** a first-time profile is created and `process.cwd()` is `/home/jason/Projects/madz`
- **THEN** the job definition contains `command: "cd /home/jason/Projects/madz && node index.js --chat \"/reflection\""`

#### Scenario: Idempotent job creation
- **WHEN** a first-time profile is created and `reflection-daily.json` already exists
- **THEN** the system skips writing the job file (no duplicate)

#### Scenario: Job is enabled by default
- **WHEN** a first-time profile is created
- **THEN** the job definition contains `enabled: true`

### Requirement: Crontab sync picks up auto-created job
The auto-created job definition SHALL be picked up by the existing init-time crontab synchronization mechanism on the next container startup.

#### Scenario: Sync installs auto-created job
- **WHEN** the application starts with `scheduler.syncOnInit` enabled and `memory/schedules/reflection-daily.json` exists
- **THEN** the system adds the job to the system crontab block

#### Scenario: Sync skips if crontab unavailable
- **WHEN** the application starts and `crontab` is not available on the system
- **THEN** the system logs a warning and the job remains as a JSON file in `memory/schedules/`
