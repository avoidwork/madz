## 1. Read and Understand Affected Code

- [ ] 1.1 Read src/scheduler/cron.js lines 40-65 to understand _readCrontab() current implementation
- [ ] 1.2 Read src/scheduler/index.js lines 20-70 to understand the sync operation and how it uses _readCrontab()
- [ ] 1.3 Read existing scheduler tests to understand test patterns and mocking approach

## 2. Implement _readCrontab() Fix

- [ ] 2.1 Modify the catch block in _readCrontab() to return "" for all errors instead of throwing
- [ ] 2.2 Add a debug-level log statement to record the error for troubleshooting
- [ ] 2.3 Ensure the function never throws under any circumstances

## 3. Update Tests

- [ ] 3.1 Add test for _readCrontab() when crontab -l fails with "no crontab" error (existing behavior, verify still passes)
- [ ] 3.2 Add test for _readCrontab() when crontab -l fails with permission denied error
- [ ] 3.3 Add test for _readCrontab() when crontab -l fails with binary not found error
- [ ] 3.4 Add test for _readCrontab() when crontab -l fails with timeout error
- [ ] 3.5 Add test for sync operation when _readCrontab() returns "" due to error
- [ ] 3.6 Verify all existing scheduler tests still pass

## 4. Verify and Clean Up

- [ ] 4.1 Run npm run test to verify all tests pass
- [ ] 4.2 Run npm run lint to verify no lint issues
- [ ] 4.3 Run npm run coverage to verify 100% coverage is maintained
- [ ] 4.4 Review the diff to ensure changes are minimal and surgical