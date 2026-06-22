## Why

Cron jobs fail to run inside Docker containers because `_readCrontab()` in `src/scheduler/cron.js` throws on any `crontab -l` error that doesn't match the "no crontab" string. When the error is thrown, the sync operation's catch block logs a warning but never writes the crontab entries, leaving crond with zero scheduled tasks. This renders the scheduler completely non-functional in containerized deployments.

## What Changes

- Modify `_readCrontab()` in `src/scheduler/cron.js` to return `""` for any error from `crontab -l`, not just the "no crontab" case
- Add a debug-level log in the catch block to record the error for troubleshooting
- Update tests to cover the new error-handling behavior, including cases where `crontab -l` fails with non-"no crontab" errors
- The sync operation in `src/scheduler/index.js` will treat `""` as "no existing madz block" and write the crontab from scratch

## Capabilities

### New Capabilities
<!-- None — this is a bug fix, not a new capability -->

### Modified Capabilities
- `cron-scheduler`: `_readCrontab()` now returns `""` on any `crontab -l` error instead of throwing, making the scheduler resilient to container environment issues (missing binary, permission denied, etc.)

## Impact

- **Affected code:** `src/scheduler/cron.js` (`_readCrontab()` function), `src/scheduler/index.js` (sync operation)
- **Affected configs:** `Dockerfile` (crontab binary availability), `docker-entrypoint.sh` (container crontab setup)
- **Tests:** `tests/unit/` — scheduler tests need updates to cover new error-handling behavior
- **No API changes** — this is an internal fix with no external surface area impact
- **No breaking changes** — returning `""` on error is functionally equivalent to the "no crontab" case that was already handled