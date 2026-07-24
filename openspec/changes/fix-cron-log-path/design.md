## Context

Cron jobs managed by `src/scheduler/cron.js` silently fail in Docker containers because `prepareCrontabCommand()` hardcodes `>> /var/log/cron-madz.log 2>&1` at line 32. The `madz` user (uid=100, gid=1000/node) cannot write to `/var/log/`, so the shell redirection fails before the script executes.

## Goals / Non-Goals

**Goals:**
- Replace hardcoded `/var/log/cron-madz.log` with a path derived from `getLogDirectory()` from `src/logger.js`
- Name the file `madz_cron.log`
- Ensure all crontab entries use the new path

**Non-Goals:**
- Adding a config.yaml option for log path (logger already provides the abstraction)
- Changing `docker-entrypoint.sh` syslog behavior
- Modifying `autoSchedule.js` (it inherits the fix via `Cron.add()`)

## Decisions

### Use `getLogDirectory()` instead of creating a new function
`src/logger.js` already has `getLogDirectory()` which handles platform-specific paths and includes fallback to `os.tmpdir()`. Reusing this avoids duplication and ensures consistency with the main app logger.

### Name the file `madz_cron.log`
Matches existing convention: `madz.log`, `madz_error.log`.

### No config.yaml changes
The logger already provides the correct abstraction. Adding a config option would be over-engineering for a single use case.

## Risks / Trade-offs

- **Module side effect**: `getLogDirectory()` creates the log directory on import. This is already the case in `src/logger.js` and has been working without issues.
- **Test mocking**: Tests that mock `src/logger.js` need to account for the directory creation side effect.
