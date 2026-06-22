## 1. Fix _readCrontab() error handling

- [ ] 1.1 Modify `_readCrontab()` in `src/scheduler/cron.js` to return `""` for ALL errors from `crontab -l`
- [ ] 1.2 Verify the catch block handles all error types (permission denied, binary not found, container environment issues)

## 2. Add unit tests for error scenarios

- [ ] 2.1 Add test: `_readCrontab()` returns `""` when `crontab -l` throws "permission denied"
- [ ] 2.2 Add test: `_readCrontab()` returns `""` when `crontab -l` throws "command not found"
- [ ] 2.3 Add test: `_readCrontab()` returns `""` when `crontab -l` throws any generic error
- [ ] 2.4 Add test: `sync()` writes madz block correctly when `_readCrontab()` returns `""`
- [ ] 2.5 Add test: `list()` returns empty array when `_readCrontab()` returns `""`

## 3. Verify existing functionality

- [ ] 3.1 Run existing cron module tests to ensure no regressions
- [ ] 3.2 Verify `sync()` still preserves external crontab entries when `_readCrontab()` succeeds
- [ ] 3.3 Verify `add()`, `remove()`, `install()`, `uninstall()` still work correctly with empty crontab