## Context

The `subAgent` tool spawns Node.js child processes to execute independent agent tasks. Currently, it uses Node.js's `spawn()` timeout option, which has a critical flaw: it only rejects the promise when the timeout fires but does not actually terminate the child process. This leaves orphaned processes consuming resources indefinitely.

The current implementation in `src/tools/subAgent.js` uses:
```js
spawn("node", ["index.js", ...], { timeout })
```

This approach has been unreliable in production — processes that hang during execution are never actually killed, leading to resource leaks and unpredictable behavior.

## Goals / Non-Goals

**Goals:**
- Replace Node.js promise-level timeout with OS-level process termination
- Ensure child processes are actually killed when timeout fires
- Add SIGKILL escalation after SIGTERM for stubborn processes
- Maintain backward compatibility with existing timeout API (milliseconds)
- Detect and report timeout events clearly (exit code 124)

**Non-Goals:**
- Changing the subAgent tool's public API or input schema
- Adding new timeout configuration options
- Modifying fan-out execution logic (parallel/sequential modes)
- Adding graceful shutdown hooks for child processes

## Decisions

### Decision 1: Use system `timeout` command instead of Node.js timeout
**Rationale:** The GNU `timeout` command is a battle-tested utility that actually terminates processes. It sends SIGTERM at the timeout, then SIGKILL after `--kill-after` seconds if the process doesn't exit. This is far more reliable than Node.js's promise-level timeout.

**Alternatives considered:**
- `process.kill()` after timeout — requires manual signal handling, error-prone
- `child.kill()` — same issue, no guaranteed cleanup
- `setTimeout` + `child.kill()` — still leaves race conditions

**Chosen approach:** `timeout --kill-after=10 <seconds> node index.js ...`

### Decision 2: Convert milliseconds to seconds with `Math.ceil()`
**Rationale:** The `timeout` command accepts seconds as integers. Using `Math.ceil()` ensures we never timeout earlier than requested (e.g., 1500ms → 2s, not 1s). This is conservative and safe.

**Trade-off:** Slightly longer actual timeout than specified (up to 999ms extra), but this is acceptable for reliability.

### Decision 3: Handle exit code 124 as timeout
**Rationale:** The `timeout` command returns exit code 124 when it terminates a process. We detect this and return a structured error response matching the existing error format.

**Implementation:**
```js
if (code === 124) {
  resolve({ ok: false, result: "", error: `Sub-agent timed out after ${timeout}ms`, sessionId });
  return;
}
```

### Decision 4: Wrap in `sh -c` for command composition
**Rationale:** The `timeout` command needs to wrap the entire `node index.js ...` command. Using `spawn("sh", ["-c", timeoutCmd])` allows shell command composition while maintaining proper argument escaping via `escapeShellArg()`.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `timeout` command not available on all systems | GNU coreutils is standard on Linux; macOS users can install via `brew install coreutils`. Document requirement. |
| Exit code 124 could conflict with actual process exit code 124 | Extremely unlikely — Node.js processes rarely exit with code 124. If needed, we could use a different signal or check stderr. |
| `--kill-after=10` adds up to 10s delay after timeout | This is intentional — gives processes time to clean up after SIGTERM. Total worst-case: timeout + 10s. Acceptable for reliability. |
| Shell escaping complexity increases | Already handled by existing `escapeShellArg()` function. No new escaping logic needed. |

## Migration Plan

1. **Deploy:** Replace `spawn()` timeout with `timeout` command wrapper in `subAgent.js`
2. **Test:** Update integration tests to verify timeout behavior and exit code 124 detection
3. **Verify:** Run full test suite, check for orphaned processes after timeout
4. **Rollback:** Revert to previous `spawn()` timeout if issues arise (simple git revert)

No database migrations, config changes, or API changes required.

## Open Questions

- Should `--kill-after` be configurable via env var or config? (Currently hardcoded to 10s)
- Should we log timeout events to a monitoring system? (Currently only in stderr)
- Is 10s enough for SIGTERM→SIGKILL escalation, or should it be longer for heavy processes?