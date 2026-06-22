## 1. Implementation (Already Complete)

- [x] 1.1 Add `msToSeconds()` helper to convert milliseconds to seconds with `Math.ceil()`
- [x] 1.2 Replace Node.js `spawn()` timeout option with `timeout --kill-after=10` command wrapper
- [x] 1.3 Add exit code 124 detection in `spawnSubAgentProcess()` exit handler
- [x] 1.4 Apply timeout wrapper to both single execution and fan-out modes (parallel/sequential)
- [x] 1.5 Ensure shell argument escaping via `escapeShellArg()` for all user inputs

## 2. Testing

- [x] 2.1 Update existing integration tests to account for `timeout` command wrapper (process hierarchy changes)
- [x] 2.2 Add test for exit code 124 timeout detection — verify `ok: false` and error message format
- [x] 2.3 Add test for `msToSeconds()` conversion — verify `Math.ceil()` behavior for edge cases (e.g., 1500ms → 2s, 2000ms → 2s)
- [x] 2.4 Add test for `--kill-after=10` flag presence in spawned command
- [x] 2.5 Verify no orphaned processes after timeout — check `/proc` or `ps` for lingering child processes
- [x] 2.6 Update test imports to include `msToSeconds` if exported, or test via integration

## 3. Verification

- [x] 3.1 Run full test suite: `npm run test` — all tests must pass (1176 pass, 0 fail)
- [x] 3.2 Run lint: `npm run lint` — no warnings or errors
- [x] 3.3 Verify application starts: `timeout 10 npm start` — no crashes
- [x] 3.4 Manual verification: spawn a long-running sub-agent and verify it times out correctly
- [x] 3.5 Verify log files are created and closed properly after timeout