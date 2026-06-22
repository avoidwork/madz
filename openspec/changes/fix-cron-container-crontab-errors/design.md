## Context

The `Cron` module in `src/scheduler/cron.js` manages madz schedule entries in the user's system crontab. All public methods (`add`, `remove`, `install`, `uninstall`, `list`, `sync`) call `_readCrontab()` to read the current crontab before performing their operation.

In container environments (Alpine Linux-based Docker images), `crontab -l` may fail for reasons beyond "no crontab installed":
- Permission denied (container security policies)
- Binary present but non-functional (Alpine's busybox crontab quirks)
- Missing user crontab support in minimal container images
- Environment variables not properly set for the crontab binary

When `crontab -l` fails, the error propagates up through `_readCrontab()`, causing the calling method to throw. The sync operation's catch block logs a warning but never writes the crontab, leaving crond with zero entries.

## Goals / Non-Goals

**Goals:**
- Make `_readCrontab()` return `""` for ALL errors from `crontab -l`
- Ensure sync and all other methods work correctly with empty crontab input
- Add unit tests covering error scenarios

**Non-Goals:**
- Fix `crontab -` (write) failures — those are surfaced as error objects, which is correct
- Preserve external crontab entries in container environments — madz is the sole manager
- Change the public API of the `Cron` module
- Add new crontab management features

## Decisions

### Decision 1: Return empty string for all `_readCrontab()` errors

**Choice:** The catch block in `_readCrontab()` returns `""` for all errors.

**Rationale:** In container environments, madz is the sole crontab manager. There are no external entries to preserve. An empty string signals "no existing crontab" which is the correct default state.

**Alternatives considered:**
- Return `null` and have callers handle null — adds complexity, no benefit
- Throw a specific `CrontabReadError` — overkill for a container-only issue, breaks existing error handling patterns
- Log the error and return `""` — logging is already done by callers' catch blocks

### Decision 2: No change to `_writeCrontab()` error handling

**Choice:** Keep existing error handling in `_writeCrontab()` — errors are caught by each public method and returned as error objects.

**Rationale:** Write failures are real operational issues that should be surfaced. The current pattern of returning `{ error: string }` is correct and consistent across all methods.

### Decision 3: No change to `isAvailable()` check

**Choice:** Keep the existing `isAvailable()` check at the start of each public method.

**Rationale:** `isAvailable()` checks for the presence of the `crontab` binary via `which crontab`. This is a different failure mode from `crontab -l` failing — it catches the case where the binary doesn't exist at all. The `_readCrontab()` fix handles the case where the binary exists but the command fails.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Silently swallowing legitimate errors (e.g., permission issues) | In container context, madz is the sole crontab manager — there are no "legitimate" external errors to miss |
| `_readCrontab()` returning `""` when it should throw | All callers already handle empty string correctly — sync builds from desired state, list returns empty array, etc. |
| Tests may not cover all container edge cases | Add explicit unit tests mocking `execSync` to throw various error types |

## Migration Plan

This is a code-only change with no migration required. The fix is backward compatible — existing deployments will continue to work, and container deployments will now function correctly.

1. Deploy the fix to the feature branch
2. Run full test suite to verify no regressions
3. Add new unit tests for error scenarios
4. Merge to main and release

## Open Questions

None. The fix is straightforward and well-scoped.