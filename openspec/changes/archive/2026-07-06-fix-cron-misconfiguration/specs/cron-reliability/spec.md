## ADDED Requirements

### Requirement: crond accepts user crontabs
The crond process SHALL be started with the `-p` flag to permit user crontabs. Without this flag, crond silently ignores crontabs owned by non-root users.

#### Scenario: crond runs with -p flag
- **WHEN** the Docker container starts
- **THEN** crond is started with the `-p` flag

#### Scenario: user crontab is accepted
- **WHEN** a crontab is installed for the `madz` user
- **THEN** crond executes the scheduled jobs

### Requirement: crond inherits PATH from environment
The crond process SHALL be started with the `-P` flag to inherit the PATH from the environment. This ensures `/usr/local/bin` (where Node.js is installed) is available to cron jobs.

#### Scenario: crond runs with -P flag
- **WHEN** the Docker container starts
- **THEN** crond is started with the `-P` flag

#### Scenario: node is accessible in cron jobs
- **WHEN** a cron job references the node binary
- **THEN** the binary at `/usr/local/bin/node` is found and executed

### Requirement: crond logs to syslog
The crond process SHALL be started with the `-s` flag to log to syslog. This provides visibility into crond's own activity (job scheduling, execution attempts).

#### Scenario: crond runs with -s flag
- **WHEN** the Docker container starts
- **THEN** crond is started with the `-s` flag

#### Scenario: crond activity is logged
- **WHEN** crond schedules or attempts to execute a job
- **THEN** the activity appears in syslog

### Requirement: crontab entries use absolute paths
All crontab entries SHALL use the absolute path to the node binary (`/usr/local/bin/node`) instead of relying on PATH resolution.

#### Scenario: crontab uses absolute node path
- **WHEN** crontab entries are installed
- **THEN** they reference `/usr/local/bin/node` explicitly

### Requirement: crontab output is redirected to log file
All crontab entries SHALL redirect stdout and stderr to `/var/log/cron-madz.log` for visibility into job execution and errors.

#### Scenario: crontab redirects output
- **WHEN** crontab entries are installed
- **THEN** they include `>> /var/log/cron-madz.log 2>&1`