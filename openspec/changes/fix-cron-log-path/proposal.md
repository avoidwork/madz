# Proposal: Fix Cron Log Path

## Change Name
fix-cron-log-path

## Summary
Replace the hardcoded `/var/log/cron-madz.log` log path in the scheduler's crontab command generator with the application's existing log directory infrastructure from `src/logger.js`. This fixes the silent cron job failure in Docker containers where the `madz` user cannot write to `/var/log/`.

## Problem
Cron jobs managed by the scheduler silently fail in Docker containers because `src/scheduler/cron.js:32` hardcodes `>> /var/log/cron-madz.log 2>&1`. The `madz` user (uid=100, gid=1000/node) lacks write permission to `/var/log/`, so the shell redirection fails before the script executes. Cron provides no visible error or alert — the job simply dies silently.

## Solution
Import `getLogDirectory()` from `src/logger.js` and use it to construct the log path dynamically. The log file should be named `madz_cron.log` to match the existing naming convention (`madz.log`, `madz_error.log`).

The `getLogDirectory()` function already handles platform-specific paths and includes fallback logic to `os.tmpdir()` if the primary directory is unwritable.

## Files Changed
- `src/scheduler/cron.js` — import `getLogDirectory`, update `prepareCrontabCommand()`
- `tests/unit/scheduler/cron.test.js` — update tests to expect the new log path

## Risks
- Minimal: single-line change in `prepareCrontabCommand()`, existing logger infrastructure is battle-tested
- No config changes needed
- No changes to `docker-entrypoint.sh` or `autoSchedule.js` required
