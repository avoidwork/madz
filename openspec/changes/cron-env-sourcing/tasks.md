## 1. Implement env.cron file writer

- [ ] 1.1 Add `writeEnvCron()` function to `src/scheduler/cron.js` that writes `.env.cron` with whitelisted variables from `process.env`
- [ ] 1.2 Export `writeEnvCron` from `src/scheduler/cron.js` and re-export from `src/scheduler/index.js`

## 2. Modify crontab command generation

- [ ] 2.1 Update `prepareCrontabCommand()` in `src/scheduler/cron.js` to prepend `. /{cwd}/.env.cron 2>/dev/null || true && ` to commands
- [ ] 2.2 Verify all code paths (add, install, sync) use the updated `prepareCrontabCommand()`

## 3. Wire env.cron generation into startup

- [ ] 3.1 Call `writeEnvCron()` in `index.js` before the `Cron.sync()` call during startup

## 4. Add tests

- [ ] 4.1 Add unit tests for `writeEnvCron()` in `tests/unit/scheduler/cron.test.js`
- [ ] 4.2 Add unit tests for `prepareCrontabCommand()` env sourcing prefix in `tests/unit/scheduler/cron.test.js`

## 5. Verify and lint

- [ ] 5.1 Run `npm run lint` to verify code quality
- [ ] 5.2 Run `npm test` to verify all tests pass
