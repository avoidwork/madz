## 1. Implementation (Already Complete)

- [x] 1.1 Add `msToSeconds()` helper to convert milliseconds to seconds with `Math.ceil()`
- [x] 1.2 Replace Node.js `spawn()` timeout option with `timeout --kill-after=10` command wrapper
- [x] 1.3 Add exit code 124 detection in `spawnSubAgentProcess()` exit handler
- [x] 1.4 Apply timeout wrapper to both single execution and fan-out modes (parallel/sequential)
- [x] 1.5 Ensure shell argument escaping via `escapeShellArg()` for all user inputs

## 2. Testing

- [ ] 2.1 Update existing integration tests to account for `timeout` command wrapper (process hierarchy changes)
- [ ] 2.2 Add test for exit code 124 timeout detection — verify `ok: false` and error message format
- [ ] 2.3 Add test for `msToSeconds()` conversion — verify `Math.ceil()` behavior for edge cases (e.g., 1500ms → 2s, 2000ms → 2s)
- [ ] 2.4 Add test for `--kill-after=10` flag presence in spawned command
- [ ] 2.5 Verify no orphaned processes after timeout — check `/proc` or `ps` for lingering child processes
- [ ] 2.6 Update test imports to include `msToSeconds` if exported, or test via integration

## 3. Verification

- [ ] 3.1 Run full test suite: `npm run test` — all tests must pass
- [ ] 3.2 Run lint: `npm run lint` — no warnings or errors
- [ ] 3.3 Verify application starts: `timeout 10 npm start` — no crashes
- [ ] 3.4 Manual verification: spawn a long-running sub-agent and verify it times out correctly
- [ ] 3.5 Verify log files are created and closed properly after timeout