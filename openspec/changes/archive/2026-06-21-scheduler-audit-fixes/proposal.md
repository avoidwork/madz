## Why

A code audit of the scheduler module identified two issues: a high-severity security vulnerability where `job.command` is interpolated directly into crontab entries without sanitization (allowing crontab format injection via newlines), and a medium-severity bug where `persistJobFile` ignores its `cwd` parameter and always uses a hardcoded path.

## What Changes

- Add a `sanitizeCrontabCommand()` helper to strip line-breaking characters from command strings before crontab interpolation
- Apply sanitization in `Cron.add()`, `Cron.install()`, and `Cron.sync()` methods in `src/scheduler/cron.js`
- Fix `persistJobFile()` in `src/scheduler/autoSchedule.js` to use the `cwd` parameter instead of the module-level `SCHEDULES_DIR` constant
- Add unit tests for the sanitization helper and integration tests for the `persistJobFile` fix

## Capabilities

### New Capabilities
- `scheduler-security`: Command sanitization to prevent crontab format injection

### Modified Capabilities
- `scheduler-persistence`: Fix `persistJobFile` to respect the `cwd` parameter

## Impact

- `src/scheduler/cron.js` — three locations where commands are interpolated into crontab entries
- `src/scheduler/autoSchedule.js` — `persistJobFile` function
- Existing crontab entries are unaffected; sanitization only applies to new/updated entries
- No API changes; all modifications are internal to the scheduler module