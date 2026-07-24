## 1. Implement the fix

- [ ] 1.1 Import `getLogDirectory` from `../logger.js` in `src/scheduler/cron.js`
- [ ] 1.2 Replace hardcoded `/var/log/cron-madz.log` with dynamic path using `getLogDirectory()`
- [ ] 1.3 Name the file `madz_cron.log`

## 2. Update tests

- [ ] 2.1 Update existing cron.js tests to expect the new log path
- [ ] 2.2 Add test for `prepareCrontabCommand` with mocked `getLogDirectory`

## 3. Verify and deliver

- [ ] 3.1 Run tests and ensure they pass
- [ ] 3.2 Run lint and format checks
- [ ] 3.3 Commit and push the branch
- [ ] 3.4 Create PR targeting main
