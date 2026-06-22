## Why

Cron jobs fail to run inside Docker containers because `_readCrontab()` in `src/scheduler/cron.js` throws on any error that isn't a "no crontab" error. In container environments, the `crontab` command may not be installed, may lack permissions, or may fail for other reasons. The current code only catches "no crontab" errors gracefully and re-throws everything else, which prevents the crontab sync from ever writing entries — effectively breaking the scheduler entirely in containers where crontab is unavailable or misconfigured.

## What Changes

- Modify the catch block in `_readCrontab()` to return an empty string for ALL errors, not just "no crontab" errors
- Add unit tests for `_readCrontab()` error handling scenarios
- No changes to the crontab sync logic in `src/scheduler/index.js` (already handles empty strings correctly)
- No changes to public APIs or external behavior — this is an internal robustness fix

## Capabilities

### New Capabilities
<!-- None — this is a bug fix, not a new capability -->

### Modified Capabilities
<!-- None — no spec-level behavior changes, only implementation robustness -->

## Impact

- **Affected code:** `src/scheduler/cron.js` (catch block in `_readCrontab()`), `tests/unit/scheduler.test.js` (new tests)
- **Dependencies:** None — no new dependencies added
- **Systems:** The scheduler component, specifically the crontab read/sync pipeline
- **Breaking changes:** None — the change is backward compatible. Code that previously received valid crontab content continues to work; code that previously crashed on non-"no crontab" errors now receives an empty string instead.