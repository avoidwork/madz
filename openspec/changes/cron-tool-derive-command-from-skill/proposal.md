## Why

The cron tool's `create` action fails to derive a command when a job is created with only a skill name and no explicit `command`. The job is persisted with `command: undefined`, and the crontab sync silently skips such jobs because `_readJobsFromDisk` requires a `command` field. This means skill-only jobs never get registered in the system crontab and never execute.

## What Changes

- `src/tools/cron/index.js` — In `cronJobImpl`'s `create` action, derive a command from the skill name when no explicit `command` is provided. Use the derived command when calling `cronModule.add` and store it on the job so it persists.
- `src/scheduler/cron.js` — In `_readJobsFromDisk`, accept `job.skill` as an alternative to `job.command`, deriving the command the same way so skill-only jobs are no longer silently skipped during crontab sync.
- Add unit tests in `tests/unit/tools_cron.test.js` and `tests/unit/scheduler/cron.test.js` for the skill-only job case.

## Capabilities

### New Capabilities

<!-- No new capabilities introduced — this is a bug fix to existing behavior. -->

### Modified Capabilities

- `cron-scheduler`: The `create` action must derive a command from the skill name when no explicit command is given, so skill-only jobs are persisted with a usable command.
- `crontab-sync`: `_readJobsFromDisk` must accept jobs that have a `skill` field instead of a `command` field, deriving the command the same way, so skill-only jobs are not silently skipped during sync.

## Impact

- **Affected code:** `src/tools/cron/index.js`, `src/scheduler/cron.js`
- **Test impact:** `tests/unit/tools_cron.test.js`, `tests/unit/scheduler/cron.test.js`
- **No API changes:** The cron tool's input schema and output format are unchanged.
- **No dependency changes:** No new packages, no version bumps.

## Non-goals

- Changing the cron tool's input schema or output format
- Changing the derivation logic in `ScheduleManager.loadFromDisk` (`src/scheduler/scheduler.js`)
- Adding new tools or features
- Refactoring unrelated scheduler or cron code
