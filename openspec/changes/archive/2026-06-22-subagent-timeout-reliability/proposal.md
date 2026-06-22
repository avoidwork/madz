## Why

Node.js `spawn()` timeout option is unreliable for terminating long-running child processes. The timeout option only rejects the promise but does not actually kill the child process, leading to orphaned processes and resource leaks. This is a known limitation of Node.js's `child_process.spawn()` — the timeout is a promise-level construct, not a process-level one.

## What Changes

- Replace Node.js `spawn()` timeout option with system `timeout` command wrapper
- Add `--kill-after=10` flag for SIGKILL escalation after initial SIGTERM
- Convert millisecond timeouts to seconds for the `timeout` command
- Detect exit code 124 (timeout indicator from `timeout` command) and report as timeout error
- Update test suite to account for `timeout` command wrapper behavior

## Capabilities

### New Capabilities
- `subagent-timeout-reliability`: Reliable child process termination using system `timeout` command with SIGTERM/SIGKILL escalation

### Modified Capabilities
<!-- None — this is a new capability, not a modification of existing requirements -->

## Impact

- **Affected code:** `src/tools/subAgent.js` — `spawnSubAgentProcess()` and `executeFanOut()` functions
- **Affected tests:** `tests/unit/tools/subAgent.test.js` — integration tests need updating for `timeout` command wrapper
- **Dependencies:** Requires GNU `timeout` command (available on Linux, macOS via coreutils)
- **Behavior change:** Timeout errors now return exit code 124 detection instead of Node.js promise rejection