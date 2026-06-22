## Why

Cron jobs managed by madz fail to run inside containers because `_readCrontab()` in `src/scheduler/cron.js` throws on any error from `crontab -l` that doesn't match the "no crontab" message. In container environments, `crontab -l` may fail for reasons other than an empty crontab — permission denied, binary not found, Alpine Linux quirks, or missing user crontab support. When this happens, the sync operation throws, the catch block logs a warning, and the crontab is never written. Result: crond runs but has zero entries.

## What Changes

- Modify `_readCrontab()` in `src/scheduler/cron.js` to return `""` for ALL errors from `crontab -l`, not just "no crontab" errors
- In container contexts, madz is the sole crontab manager — external entries don't exist and don't need to be preserved
- When `_readCrontab()` returns `""`, sync treats the crontab as empty and writes the full madz block from desired state
- Add unit tests covering error scenarios (permission denied, binary not found, container environment failures)

## Capabilities

### New Capabilities
<!-- None — this is an internal fix, no new user-facing capabilities -->

### Modified Capabilities
- `cron-scheduler`: `_readCrontab()` now returns empty string for all `crontab -l` errors instead of throwing, enabling correct operation in container environments where the crontab is managed entirely by madz

## Impact

- **Affected code**: `src/scheduler/cron.js` — `_readCrontab()` method (lines 46-57), `sync()` method (lines 409-496)
- **Affected methods**: `add()`, `remove()`, `install()`, `uninstall()`, `list()`, `sync()` — all call `_readCrontab()` and must handle empty crontab correctly
- **No API changes**: The public interface of `Cron` remains unchanged
- **No breaking changes**: Existing callers already handle empty string input from `_readCrontab()`
- **Test coverage**: Existing tests must pass; new tests added for error scenarios