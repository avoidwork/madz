## ADDED Requirements

### Requirement: Cron jobs use writable log path
The scheduler SHALL use the application's log directory (from `getLogDirectory()`) for cron job output redirection instead of a hardcoded `/var/log/` path.

#### Scenario: Cron command uses logger directory
- **WHEN** `prepareCrontabCommand()` is called
- **THEN** the returned command redirects output to `<logDir>/madz_cron.log 2>&1` where `<logDir>` is the value returned by `getLogDirectory()`

#### Scenario: Cron command uses correct filename
- **WHEN** `prepareCrontabCommand()` is called
- **THEN** the log file is named `madz_cron.log`

#### Scenario: Alpine Docker container can write to log
- **WHEN** the app runs in an Alpine Linux Docker container
- **THEN** cron jobs write output to `~/.cache/madz/logs/madz_cron.log` without permission errors

#### Scenario: Non-Alpine Linux can write to log
- **WHEN** the app runs on a standard Linux system
- **THEN** cron jobs write output to `~/.local/share/madz/logs/madz_cron.log` without permission errors
