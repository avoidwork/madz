## 1. Implement command sanitization helper

- [ ] 1.1 Create `sanitizeCrontabCommand()` helper function in `src/scheduler/cron.js` that strips `\n`, `\r\n`, and `\r` from command strings
- [ ] 1.2 Write unit tests for `sanitizeCrontabCommand()`: normal commands pass through, commands with newlines are sanitized, commands with carriage returns are sanitized, shell special characters are preserved, empty/whitespace commands handled

## 2. Apply sanitization in Cron.add()

- [ ] 2.1 Import or reference `sanitizeCrontabCommand()` in the `add()` method
- [ ] 2.2 Apply sanitization to `job.command` before interpolation at line 109
- [ ] 2.3 Verify existing `add()` tests still pass

## 3. Apply sanitization in Cron.install()

- [ ] 3.1 Apply sanitization to `s.command` before interpolation at line 216
- [ ] 3.2 Verify existing `install()` tests still pass

## 4. Apply sanitization in Cron.sync()

- [ ] 4.1 Apply sanitization to `j.command` before interpolation at line 415
- [ ] 4.2 Verify existing `sync()` tests still pass

## 5. Fix persistJobFile cwd parameter

- [ ] 5.1 Replace `const schedulesDir = SCHEDULES_DIR;` with `const schedulesDir = cwd;` in `persistJobFile()` in `src/scheduler/autoSchedule.js`
- [ ] 5.2 Write integration test verifying `persistJobFile()` uses the `cwd` parameter
- [ ] 5.3 Verify existing `autoSchedule.js` tests still pass

## 6. Verify full test suite

- [ ] 6.1 Run `npm run test` and verify all tests pass
- [ ] 6.2 Run `npm run lint` and verify no lint errors
- [ ] 6.3 Verify application starts without crashing