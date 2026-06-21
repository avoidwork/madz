## Context

The madz scheduler manages system crontab entries via the `Cron` module in `src/scheduler/cron.js`. Entries are written as a delimited block (`# --- BEGIN madz-schedules ---` / `# --- END madz-schedules ---`) within the user's system crontab. The `_readCrontab()` private method reads the current crontab via `crontab -l` and is called by all public methods (`sync`, `install`, `add`, `remove`, `uninstall`, `list`).

In the Docker container deployment, madz is the sole crontab manager. The container installs `cronie` and starts `crond` via `docker-entrypoint.sh`. However, when `_readCrontab()` encounters any error from `crontab -l` that doesn't match "no crontab" (e.g., permission denied, binary not found at runtime, etc.), it throws. This causes the calling method's sync operation to fail silently — the catch block logs a warning but never writes the crontab. Result: crond runs with zero entries.

## Goals / Non-Goals

**Goals:**
- Fix `_readCrontab()` to return `''` for all `crontab -l` errors, not just "no crontab"
- Ensure all crontab operations proceed correctly in container contexts where madz owns the crontab
- Add unit tests for error handling edge cases

**Non-Goals:**
- Preserving external crontab entries (not needed in container context)
- Changes to public API surface or return types
- Changes to `_writeCrontab()` or other cron module methods
- Bare-metal or VM deployment considerations

## Decisions

### Decision 1: Return `''` for all errors in `_readCrontab()`
**Rationale:** In a container context, madz manages the crontab entirely. An unreadable crontab is functionally equivalent to an empty one — there are no external entries to preserve. Returning `''` allows the calling methods to proceed with a clean slate and write the madz block from scratch.

**Alternatives considered:**
- Log the error and rethrow with more context — adds noise without value in container context
- Return `null` and have callers handle it — changes the contract of a private method unnecessarily
- Add a configuration flag for container vs. bare-metal — over-engineering for a single deployment target

### Decision 2: No changes to public API
**Rationale:** The fix is internal to `_readCrontab()`. All public methods already handle empty crontab content correctly — they split, rebuild, and write the madz block. No caller needs to change.

## Risks / Trade-offs

- [Risk] This change silently swallows all `crontab -l` errors, including unexpected ones.
  → **Mitigation:** The `isAvailable()` check already guards against the binary not being found. Remaining errors are runtime issues (permissions, empty state) that are correctly treated as "no crontab" in container context. If a truly unexpected error occurs, the subsequent `_writeCrontab()` call will fail and be caught by the caller's existing error handling.

- [Risk] On bare-metal deployments, external crontab entries would be lost.
  → **Mitigation:** This is not a concern for the current deployment model. The Docker container is the primary (and currently only) deployment target. If bare-metal support is added in the future, a configuration flag or separate code path can be introduced.

## Migration Plan

No migration needed. This is a pure code change with no data migration, configuration changes, or deployment steps. The fix takes effect immediately on the next scheduler sync.

## Open Questions

None. The fix is straightforward and well-scoped.