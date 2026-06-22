## 1. Implement command sanitization helper

- [x] 1.1 Create `sanitizeCrontabCommand()` helper function in `src/scheduler/cron.js` that strips `\n`, `\r\n`, and `\r` from command strings
- [x] 1.2 Write unit tests for `sanitizeCrontabCommand()`: normal commands pass through, commands with newlines are sanitized, commands with carriage returns are sanitized, shell special characters are preserved, empty/whitespace commands handled

## 2. Apply sanitization in Cron.add()

- [x] 2.1 Import or reference `sanitizeCrontabCommand()` in the `add()` method
- [x] 2.2 Apply sanitization to `job.command` before interpolation at line 109
- [x] 2.3 Verify existing `add()` tests still pass

## 3. Apply sanitization in Cron.install()

- [x] 3.1 Apply sanitization to `s.command` before interpolation at line 216
- [x] 3.2 Verify existing `install()` tests still pass

## 4. Apply sanitization in Cron.sync()

- [x] 4.1 Apply sanitization to `j.command` before interpolation at line 415
- [x] 4.2 Verify existing `sync()` tests still pass

## 5. Fix persistJobFile cwd parameter

> **REMOVED** — This task was incorrect. `persistJobFile()` must use `SCHEDULES_DIR`, not `cwd`. Reverted in commit 6c70459.

## 6. Verify full test suite

- [x] 6.1 Run `npm run test` and verify all tests pass
- [x] 6.2 Run `npm run lint` and verify no lint errors
- [x] 6.3 Verify application starts without crashing