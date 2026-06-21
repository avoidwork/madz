## 1. Fix _readCrontab() error handling

- [ ] 1.1 Read src/scheduler/cron.js lines 46-59 to confirm current catch block behavior
- [ ] 1.2 Change the _readCrontab() catch block to return '' for all errors instead of throwing
- [ ] 1.3 Verify the change is minimal — only the catch block body changes, no API surface changes

## 2. Add unit tests for _readCrontab() error handling

- [ ] 2.1 Read existing tests/scheduler/cron.test.js to understand test patterns and mocking approach
- [ ] 2.2 Add test: _readCrontab returns '' when crontab -l throws "no crontab" error (verify existing test still passes)
- [ ] 2.3 Add test: _readCrontab returns '' when crontab -l throws permission denied error
- [ ] 2.4 Add test: _readCrontab returns '' when crontab -l throws "command not found" error
- [ ] 2.5 Add test: _readCrontab returns '' when crontab -l throws any generic error
- [ ] 2.6 Add test: _readCrontab returns '' when crontab -l throws with error.stdout containing "no crontab"

## 3. Verify all tests pass

- [ ] 3.1 Run npm run test and verify all tests pass
- [ ] 3.2 Run npm run lint and verify no lint errors
- [ ] 3.3 Run npm run coverage and verify coverage is maintained