## Why

Cron jobs fail to run inside Docker containers because `_readCrontab()` in `src/scheduler/cron.js` throws on any error that isn't a "no crontab" message. In container environments, `crontab -l` may fail with errors like "binary not found" or "permission denied", causing the entire crontab sync to fail silently. This prevents madz from writing its managed crontab block, leaving cron jobs non-functional.

## What Changes

- Modify `_readCrontab()` in `src/scheduler/cron.js` to return an empty string (`""`) for ALL errors, not just "no crontab" messages
- Update existing unit tests in `tests/unit/cron.test.js` to reflect the new error handling behavior
- No new capabilities or API changes — this is a pure bug fix

## Capabilities

### New Capabilities
<!-- None — this is a bug fix, not a new feature -->

### Modified Capabilities
- `cron-scheduler`: The requirement that `_readCrontab()` must gracefully handle all crontab errors, not just "no crontab" messages. The existing behavior of throwing on non-"no crontab" errors is incorrect for container environments.

## Impact

- **Affected code:** `src/scheduler/cron.js` (specifically `_readCrontab()` method, lines 46-59)
- **Tests:** `tests/unit/cron.test.js` — existing tests need updating to expect `""` return value for all error scenarios
- **Dependencies:** No new dependencies. The fix assumes that in container contexts, madz fully manages the crontab (no pre-existing user crontab to preserve)
- **Breaking changes:** None. The behavioral change is internal — the public API of the scheduler remains unchanged