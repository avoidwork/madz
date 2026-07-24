## Why

Cron jobs managed by the scheduler silently fail because `prepareCrontabCommand()` hardcodes the log path `/var/log/cron-madz.log`, which is unwritable by the `madz` user in Docker containers. The shell redirection fails before the script even executes, and cron provides no visible error. This affects all scheduled jobs including the daily reflection and Canadian News email jobs.

## What Changes

- Add a configurable `scheduler.logPath` field to the config schema with a default of `/app/cron-madz.log`
- Replace the hardcoded `/var/log/cron-madz.log` in `prepareCrontabCommand()` with the configurable path from the config singleton
- Add writability validation for the log path with warning on failure
- Add unit tests for the configurable log path functionality

## Capabilities

### New Capabilities
- `scheduler-log-path`: Configurable log output path for cron job redirection, with validation that the path is writable before scheduling.

### Modified Capabilities
- None — no existing spec-level behavior changes.

## Impact

- `src/config/schemas.js` — Add `scheduler.logPath` to the config schema
- `src/scheduler/cron.js` — Replace hardcoded log path with configurable value in `prepareCrontabCommand()`
- `tests/unit/scheduler/cron.test.js` — Add tests for configurable log path

## Non-goals

- Changing the log format or log rotation strategy
- Adding a new logging subsystem (e.g., Winston, Pino for cron output)
- Modifying the scheduler's in-process mode (only system crontab mode is affected)