## Context

The scheduler module (`src/scheduler/cron.js`) hardcodes the log path `/var/log/cron-madz.log` in `prepareCrontabCommand()`. This path is unwritable by the `madz` user in Docker containers, causing all cron jobs to silently fail. The shell redirection fails before the script even executes, and cron provides no visible error.

## Goals / Non-Goals

**Goals:**
- Add a configurable `scheduler.logPath` field to the config schema
- Replace the hardcoded log path in `prepareCrontabCommand()` with the configurable value
- Add writability validation with warning on failure
- Add unit tests for the configurable log path

**Non-Goals:**
- Changing the log format or log rotation strategy
- Adding a new logging subsystem
- Modifying the scheduler's in-process mode

## Decisions

1. **Use config singleton rather than passing logPath as a parameter.** This keeps the change minimal and consistent with how other config values are used throughout the codebase. The config singleton is already imported in `cron.js` via `../config/loader.js`.

2. **Default to `/app/cron-madz.log`.** This matches the manual fix the user already applied and is writable in the Docker container. The path is configurable, so users can override it if needed.

3. **Writability check is a warning, not a hard failure.** This allows the crontab entry to be created even if the path is unwritable, matching the existing behavior where cron silently fails. A warning log entry makes the issue visible without blocking the schedule operation.

## Risks / Trade-offs

- **Risk:** Existing deployments without `logPath` in config.yaml will use the default `/app/cron-madz.log`. **Mitigation:** This is the desired behavior — it matches the manual fix already applied.
- **Risk:** The log path validation uses `fs.access()` which may not reflect actual writability at cron execution time (e.g., if permissions change). **Mitigation:** The warning is logged at schedule creation time, which is when the user can take action. The actual cron failure is still caught by the periodic health check recommendation in the issue.