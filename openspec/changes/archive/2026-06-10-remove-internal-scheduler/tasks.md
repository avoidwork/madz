## 1. Rename CronInstaller to Cron, add CRUD ops

- [x] 1.1 Create `src/scheduler/cron.js` (or edit in place) with class renamed `Cron`
- [x] 1.2 Add `add({ name, cron, command, ... })` — read crontab, append entry with exact command, write back
- [x] 1.3 Add `remove(name)` — read crontab, delete entry, write back
- [x] 1.4 Make `list()` public API (already exists)
- [x] 1.5 Keep `isAvailable()` as-is
- [x] 1.6 Update `src/scheduler/index.js` exports

## 2. cronjob tool calls Cron CRUD ops

- [x] 2.1 Import `Cron` in `src/tools/cron.js`
- [x] 2.2 In `create` action: after saving JSON, call `Cron.add(job)` with new job data (including `command`)
- [x] 2.3 In `remove` action: after `unlink()` deletes JSON file, call `Cron.remove(jobName)`
- [x] 2.4 Wire Cron into the cronjob tool as a runtime option in `index.js`

## 3. Remove ScheduleManager clock tick loop

- [x] 3.1 Remove `#tickId` field from ScheduleManager class
- [x] 3.2 Remove `start()` method from ScheduleManager class
- [x] 3.3 Remove `stop()` method from ScheduleManager class
- [x] 3.4 Remove `#clockTick()` method from ScheduleManager class
- [x] 3.5 Remove imports of `matchesCron`, `ScheduleQueue`, `runScheduledSkill`, `logScheduleResult` from `scheduler.js`

## 4. Remove supporting modules

- [x] 4.1 Remove `src/scheduler/queue.js`
- [x] 4.2 Remove `src/scheduler/runner.js`
- [x] 4.3 Remove `src/scheduler/logger.js`
- [x] 4.4 Remove `src/scheduler/matcher.js`
- [x] 4.5 Remove `src/scheduler/parser.js`

## 5. Update scheduler index exports

- [x] 5.1 Remove exports of ScheduleQueue from `src/scheduler/index.js`
- [x] 5.2 Remove imports of queue, runner, logger, matcher, parser from `src/scheduler/index.js`
- [x] 5.3 Rename CronInstaller export to Cron in `src/scheduler/index.js`

## 6. Update tests

- [x] 6.1 Update `tests/unit/scheduler.test.js` — remove tests for `start()`, `stop()`, `#clockTick()`, `matchesCron`, queue integration; add tests for Cron.add() and Cron.remove()
- [x] 6.2 Remove `tests/unit/scheduler_runner.test.js`
- [x] 6.3 Update `tests/unit/tools_cron.test.js` — verify no scheduler module dependency, add tests for `command` field handling
