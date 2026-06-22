## 1. Audit _readCrontab() method

- [ ] 1.1 Review src/scheduler/cron.js _readCrontab() method — confirm the throw behavior and its impact on sync() and install()
- [ ] 1.2 Verify that isAvailable() check happens before _readCrontab() is called in all public methods

## 2. Implement the fix

- [ ] 2.1 Modify src/scheduler/cron.js _readCrontab() catch block — change 'throw new Error(...)' to 'return ""' for all errors
- [ ] 2.2 Ensure the change is minimal — only modify the catch block behavior, no changes to method signatures or calling conventions

## 3. Add tests

- [ ] 3.1 Add test for _readCrontab() returning empty string when crontab -l fails with non-"no crontab" error
- [ ] 3.2 Add test for _readCrontab() returning empty string when crontab -l fails with permission denied error
- [ ] 3.3 Add test for sync() working correctly when _readCrontab() returns empty string
- [ ] 3.4 Add test for install() working correctly when _readCrontab() returns empty string

## 4. Verify

- [ ] 4.1 Run existing test suite to ensure no regressions (1129 tests)
- [ ] 4.2 Run lint to ensure code style compliance
- [ ] 4.3 Verify crond starts with madz-managed entries on fresh container with no pre-existing crontab