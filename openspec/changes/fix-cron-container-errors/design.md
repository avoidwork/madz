## Context

The scheduler component in madz uses crontab to manage scheduled jobs. In container environments, the `crontab` command may not be installed, may lack permissions, or may fail for other reasons. The `_readCrontab()` method in `src/scheduler/cron.js` currently only handles "no crontab" errors gracefully (returning an empty string), but throws on all other errors. This prevents the crontab sync from ever writing entries when crontab is unavailable, effectively breaking the scheduler in container environments.

**Current state:**
- `_readCrontab()` catches errors from the `crontab -l` command
- If the error message contains "no crontab", it returns ""
- For all other errors, it throws an Error with the message
- The sync logic in `src/scheduler/index.js` calls `_readCrontab()` and expects either a valid crontab string or an empty string

**Constraints:**
- The fix must be minimal and surgical — no architectural changes
- The change must be backward compatible
- No logging should be added (silent failure is intentional for container environments)

## Goals / Non-Goals

**Goals:**
- Make `_readCrontab()` return an empty string for ALL errors, not just "no crontab" errors
- Ensure the crontab sync can proceed even when crontab is unavailable
- Add unit tests to verify error handling behavior

**Non-Goals:**
- Adding logging for crontab errors
- Changing the crontab sync logic in `src/scheduler/index.js`
- Adding new capabilities or features to the scheduler
- Handling crontab installation or configuration

## Decisions

### Decision 1: Return empty string for all errors instead of throwing

**Choice:** Modify the catch block in `_readCrontab()` to always return "" regardless of error type.

**Rationale:**
- An empty string is already the correct representation of "no existing crontab entries"
- The downstream sync logic already handles empty strings correctly
- Throwing errors prevents the scheduler from functioning in containers where crontab is unavailable
- Silent failure is the correct behavior for container environments where crontab may not be installed

**Alternatives considered:**
1. **Add logging before returning:** Rejected — adds noise to logs for expected container behavior
2. **Throw a specific "crontab unavailable" error:** Rejected — changes the contract of `_readCrontab()` and would require changes to downstream code
3. **Check for crontab availability before calling:** Rejected — adds complexity and race conditions; silent failure is simpler and more robust

### Decision 2: No changes to index.js

**Choice:** Leave the crontab sync logic in `src/scheduler/index.js` unchanged.

**Rationale:**
- The sync logic already treats empty strings as "no existing crontab entries"
- No changes needed to handle the new behavior
- Minimizes the diff and reduces risk of introducing regressions

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Debugging future crontab issues may be harder due to silent failure | Operators can check container logs for crontab installation status; the empty string return is still visible in code |
| Existing tests may assume `_readCrontab()` throws on errors | Update tests to verify empty string return instead of exception throwing |
| Silent failure may mask real configuration issues | Acceptable trade-off for container environments; crontab unavailability is expected, not an error |

## Migration Plan

This is a code-only change with no migration required:
1. Deploy the updated `src/scheduler/cron.js`
2. No changes to configuration or data
3. No rollback procedure needed — the change is backward compatible

## Open Questions

None. The fix is straightforward and well-understood.