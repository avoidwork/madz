## 1. Update Config Schema

- [ ] 1.1 Add `logPath` field to `SchedulesSchema` in `src/config/schemas.js` with default `/app/cron-madz.log`
- [ ] 1.2 Add `logPath` to `DEFAULT_CONFIG` in `src/config/schemas.js`

## 2. Update Cron Module

- [ ] 2.1 Modify `prepareCrontabCommand()` in `src/scheduler/cron.js` to use configurable log path from config singleton
- [ ] 2.2 Add writability check for the log path in `prepareCrontabCommand()` with warning on failure

## 3. Write Tests

- [ ] 3.1 Add test for default log path in `tests/unit/scheduler/cron.test.js`
- [ ] 3.2 Add test for custom log path in `tests/unit/scheduler/cron.test.js`
- [ ] 3.3 Add test for writability warning in `tests/unit/scheduler/cron.test.js`

## 4. Verify

- [ ] 4.1 Run `npm run test` and ensure all tests pass
- [ ] 4.2 Run `npm run lint` and ensure no lint errors
- [ ] 4.3 Run `npm run coverage` and ensure coverage is maintained
- [ ] 4.4 Verify application starts with `npm start`