## ADDED Requirements

### Requirement: Crond starts as a background daemon

The Docker entrypoint SHALL start the crond daemon without the `-f` (foreground) flag, allowing it to properly daemonize and execute scheduled jobs.

#### Scenario: Entrypoint starts crond correctly

- **WHEN** the Docker container starts
- **THEN** `docker-entrypoint.sh` invokes `crond &` (without `-f`)
- **THEN** crond daemonizes and begins its cron loop

#### Scenario: Scheduled jobs execute

- **WHEN** crontab entries are present (via the cronJob tool)
- **THEN** crond picks up the entries and executes them on schedule
