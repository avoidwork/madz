## 1. Remove MADZ_SUBAGENT_TIMEOUT env var

- [ ] 1.1 Remove `process.env.MADZ_SUBAGENT_TIMEOUT` check from `resolveTimeout()` in `src/tools/subAgent.js`
- [ ] 1.2 Verify the fallback chain works: per-call → config.yaml `process.subAgent.timeout` → hardcoded default (600000ms)
- [ ] 1.3 Update tool description to remove "Overrides MADZ_SUBAGENT_TIMEOUT env var" reference

## 2. Remove MADZ_SESSION_ID from child process env

- [ ] 2.1 Remove `MADZ_SESSION_ID` from child process environment in `src/tools/subAgent.js`
- [ ] 2.2 Search entire codebase for any other references to `MADZ_SESSION_ID` and remove them
- [ ] 2.3 Verify child process still receives all other necessary env vars

## 3. Update tests

- [ ] 3.1 Remove tests that validate `MADZ_SUBAGENT_TIMEOUT` env var priority in `tests/unit/tools/subAgent.test.js`
- [ ] 3.2 Remove any tests that set or check `MADZ_SESSION_ID`
- [ ] 3.3 Ensure remaining tests still provide adequate coverage for timeout and session behavior

## 4. Verify

- [ ] 4.1 Run `npm run test` and verify all tests pass
- [ ] 4.2 Run `npm run lint` and verify no lint errors
- [ ] 4.3 Run `npm start` and verify application starts without crashing