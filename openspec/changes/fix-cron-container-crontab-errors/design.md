## Context

The scheduler's init-time crontab synchronization reads the current system crontab to find any existing madz-managed block. In containerized deployments, `crontab -l` can fail for reasons unrelated to madz — the binary may not be installed, permissions may be denied, or the command may timeout. Currently, `_readCrontab()` only handles the "no crontab" case and throws on any other error, which causes the entire sync operation to fail silently (the catch block logs a warning but never writes the crontab). This leaves crond with zero entries.

## Goals / Non-Goals

**Goals:**
- Make `_readCrontab()` resilient to any `crontab -l` failure by returning `""` instead of throwing
- Ensure the sync operation always writes the madz-managed crontab entries, even when the initial read fails
- Add debug-level logging to aid troubleshooting when `crontab -l` fails
- Maintain 100% test coverage

**Non-Goals:**
- Preserving or merging external crontab entries (container context is fully managed by madz)
- Changes to non-container deployment scenarios
- Adding new scheduler features or capabilities

## Decisions

1. **Return `""` on any error, don't re-throw.**
   - _Rationale:_ The sync operation only needs to know whether madz already has a crontab block. In a container, madz is the sole crontab manager, so external entries are irrelevant. Returning `""` is functionally equivalent to the "no crontab" case that was already handled.
   - _Alternatives considered:_ 
     - Swallowing the error silently — rejected because we need debug-level logging for troubleshooting
     - Throwing a specific "crontab unavailable" error — rejected because it would still break the sync operation

2. **Add debug-level log, not error-level.**
   - _Rationale:_ `crontab -l` failing in a container is expected in some environments (e.g., minimal base images). Logging at error level would create noise. Debug level provides visibility without alarming users.

3. **No changes to the sync operation's catch block.**
   - _Rationale:_ The sync operation already handles `""` correctly — it treats it as "no existing madz block" and writes from scratch. The fix is localized to `_readCrontab()`.

## Risks / Trade-offs

- **[Risk]** If `crontab -l` fails due to a genuine system issue (e.g., disk corruption), the error is silently swallowed.
  → **Mitigation:** Debug-level log provides visibility. In a container context, this is acceptable — the container should be rebuilt, not repaired in-place.

- **[Risk]** In non-container environments, pre-existing crontab entries could be overwritten.
  → **Mitigation:** This is a container-specific issue. The Dockerfile and docker-entrypoint.sh set up the container environment where madz fully manages the crontab. Non-container deployments are unaffected.

## Migration Plan

No migration needed. This is a bug fix that changes error handling behavior. The fix is backward-compatible — returning `""` on error is functionally equivalent to the "no crontab" case.

## Open Questions

None. The fix is straightforward and well-scoped.