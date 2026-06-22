## Context

The madz scheduler manages cronie jobs by reading and writing the user's system crontab. In `src/scheduler/cron.js`, the `_readCrontab()` method calls `crontab -l` to read the current crontab. When `crontab -l` fails, the catch block only returns an empty string for "no crontab" errors. For any other error (permission denied, binary not found, empty crontab in fresh container, etc.), it throws an error.

This causes the `sync()` and `install()` methods to fail silently — the error propagates up and is caught by a higher-level handler that logs a warning but never writes the madz crontab block. Result: crond runs but has zero entries.

The issue is specifically problematic in Docker containers where:
1. Fresh containers may have no pre-existing crontab
2. The crontab binary may not be installed or may behave differently
3. madz fully manages the crontab in container context — there are no external entries to preserve

## Goals / Non-Goals

**Goals:**
- Make `_readCrontab()` return an empty string for ALL errors, not just "no crontab" errors
- Allow `sync()` and `install()` to proceed on fresh containers with no pre-existing crontab
- Add unit tests for crontab error handling scenarios

**Non-Goals:**
- Changes to crontab management logic outside of `_readCrontab()`
- Changes to how external crontab entries are preserved (not needed in container context)
- Changes to the `isAvailable()` check or other public methods
- Integration tests for crond itself

## Decisions

### Decision 1: Return empty string for all errors in `_readCrontab()` catch block

**Rationale:** In a container context, madz fully manages the crontab — there are no external entries to preserve. The `sync()` and `install()` methods only need to know the current madz block (if any). If `_readCrontab()` returns `""`, the downstream methods will treat it as an empty crontab and write the madz block correctly.

**Alternatives considered:**
- **Log a warning before returning empty string:** This would add noise to the logs for a common and expected scenario (fresh container with no crontab). The `isAvailable()` check already handles the case where crontab is truly unavailable.
- **Throw a specific error type:** This would require changes to all callers to handle the new error type, adding complexity for no benefit in the container context.
- **Check for crontab existence before reading:** This would add an extra system call and complexity. The `isAvailable()` check already handles this.

### Decision 2: No changes to method signatures or calling conventions

**Rationale:** This is a bug fix, not a feature change. The method already returns an empty string for "no crontab" errors, so returning an empty string for other errors is consistent with the existing behavior. No changes to callers are needed.

### Decision 3: No error visibility loss

**Rationale:** The `isAvailable()` method already checks for crontab binary availability before any read/write operations in all public methods. If the crontab binary is truly unavailable, `isAvailable()` will return `{ available: false, error: "..." }` and the public methods will return early with an error. The `_readCrontab()` change only affects the case where the binary exists but `crontab -l` fails for other reasons.

## Risks / Trade-offs

### Risk: Silently swallowing errors might hide real problems

**Mitigation:** The `isAvailable()` check happens before `_readCrontab()` is called in all public methods, so truly unavailable crontab systems are still caught early. The change only affects the case where the binary exists but `crontab -l` fails for other reasons (e.g., empty crontab in fresh container).

### Risk: Breaking change if any code depends on `_readCrontab()` throwing errors

**Mitigation:** `_readCrontab()` is a private method (prefixed with `_`). No external code should depend on its error behavior. The existing tests should catch any regressions.

### Risk: Container environment may differ from test environment

**Mitigation:** Add unit tests that mock `crontab -l` to return various error scenarios. This ensures the fix works regardless of the actual container environment.

## Migration Plan

This is a bug fix with no migration plan required. The change is:
1. Minimal — only one line change in `_readCrontab()`
2. Backward compatible — the method already returns an empty string for "no crontab" errors
3. Well-tested — new unit tests cover all error scenarios

## Open Questions

None. The fix is straightforward and well-understood.