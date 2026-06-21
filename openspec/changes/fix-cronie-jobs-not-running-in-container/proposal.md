## Why

Cronie jobs fail to run inside the madz container because `_readCrontab()` in `src/scheduler/cron.js` throws on any error from `crontab -l` that doesn't match "no crontab". In a container context where madz manages the crontab entirely, this means any non-"no crontab" error (permission denied, binary not found, etc.) causes the sync operation to throw, and the catch block logs a warning but never writes the crontab. Result: crond runs but has zero entries.

## What Changes

- Simplify `_readCrontab()` catch block to return `''` for ALL errors instead of throwing on non-"no crontab" errors
- Add unit tests for `_readCrontab()` error handling edge cases (permission denied, binary not found, generic execution errors)
- No changes to public API surface or return types

## Capabilities

### New Capabilities
<!-- No new capabilities — this is a bug fix -->

### Modified Capabilities
- `scheduler`: `_readCrontab()` now returns `''` for all `crontab -l` errors instead of throwing, ensuring the sync/install/add/remove operations always proceed with an empty baseline in container contexts

## Impact

- **Affected code:** `src/scheduler/cron.js` (lines 54-59, `_readCrontab()` catch block)
- **Affected tests:** `tests/scheduler/cron.test.js` (new tests for error handling edge cases)
- **Dependencies:** None — purely internal change to error handling
- **Systems:** Container deployment (Docker) — the primary deployment target where madz owns the crontab entirely