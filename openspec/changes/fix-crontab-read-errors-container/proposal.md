## Why

Cronie jobs scheduled within the Docker container fail to execute because `_readCrontab()` throws on any error that doesn't match 'no crontab'. If `crontab -l` fails for any other reason (permission denied, binary not found, empty crontab in fresh container), the sync operation throws and the catch block logs a warning but never writes the madz crontab block. Result: crond runs but has zero entries.

## What Changes

- Modify `_readCrontab()` in `src/scheduler/cron.js` to return `''` for ALL errors, not just 'no crontab' errors
- Add unit tests for crontab error handling scenarios (empty crontab, unreadable crontab, crontab errors)
- No new capabilities or API changes — this is a bug fix

## Capabilities

### New Capabilities
<!-- None — this is a bug fix, not a new feature -->

### Modified Capabilities
- `scheduler`: `_readCrontab()` now returns empty string for all crontab read errors instead of throwing, allowing sync/install to proceed on fresh containers

## Impact

- **Affected code:** `src/scheduler/cron.js` — `_readCrontab()` method (lines 46-59)
- **Affected tests:** `src/scheduler/cron.test.js` — add tests for error handling scenarios
- **Dependencies:** None — this is an internal change with no external API impact
- **Systems:** Docker container scheduler, crontab management