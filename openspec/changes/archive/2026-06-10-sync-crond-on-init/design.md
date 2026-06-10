## Context

The scheduler currently uses a two-store model:
1. **Disk store**: JSON files in `memory/schedules/` managed by the `cronjob` tool
2. **System crontab**: Entries written via the `Cron` class using block markers (`# --- BEGIN madz-schedules ---`)

The `Cron.install()` method replaces the entire block but is only called explicitly (e.g., by the TUI). On container init, the in-memory `ScheduleManager` is empty — it has no knowledge of what jobs exist on disk. If crontab entries were manually edited or became stale, the system has no way to reconcile them.

The container runs `crond -f` in the background via `docker-entrypoint.sh` before the Node.js process starts. The Node.js process never directly controls the crond daemon — it only writes to the user's crontab.

## Goals / Non-Goals

**Goals:**
- Automatically reconcile `memory/schedules/*.json` files with the system crontab block on every container init
- Ensure no duplicate entries, no orphaned entries, and correct handling of paused/removed jobs
- Never interrupt or signal running crond jobs
- Make the sync opt-out via config flag

**Non-Goals:**
- Real-time crontab sync (changes are only applied on init, not at runtime)
- Handling jobs created outside the `cronjob` tool that fall outside the madz block
- Reconciling with any other crontab management tool
- Migrating existing in-process scheduler clock logic (that's handled by `remove-internal-scheduler`)

## Decisions

### Decision 1: Sync as a separate `Cron.sync()` method, not an enhancement of `install()`
**Rationale**: `install()` is called with an explicit array of schedule objects. The sync needs a different input source — it reads from disk (JSON files) and compares against the crontab. Separating concerns keeps `install()` stable and makes the sync function testable in isolation.

**Alternative considered**: Enhance `install()` to accept a `fromDisk: true` flag. Rejected because it would couple the install API to a disk-reading concern that doesn't belong there.

### Decision 2: Full block replacement (not incremental merge)
**Rationale**: The block-based approach is already in use. Full replacement is atomic, predictable, and avoids edge cases with partial merges. The sync reads the current block, computes the desired state from disk, and writes the block back in one operation.

**Alternative considered**: Incremental add/remove entries one at a time. Rejected because it introduces race conditions and makes it harder to guarantee no duplicates.

### Decision 3: Sync runs synchronously during boot, before TUI initialization
**Rationale**: The crontab must be in a consistent state before any scheduled job could fire. Running it synchronously ensures the state is ready. The operation is fast (read a few JSON files, read crontab, write crontab — all local I/O).

**Alternative considered**: Async sync with a "sync complete" flag. Rejected because there's no benefit to deferring it — the operation is fast and correctness requires it to happen before first use.

### Decision 4: Default `syncOnInit: true` in config
**Rationale**: Most users running in containers want this behavior. Those who manage crontab externally can opt out.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Sync overwrites crontab changes made outside madz within the block | The sync only operates within the `# --- BEGIN madz-schedules ---` block. Lines outside the block are preserved. |
| Race condition if crontab is modified between read and write | Extremely unlikely in a single-process container. The operation is atomic at the `crontab -` level. |
| Large number of jobs slow down startup | I/O is local and fast. Even 100+ jobs would complete in <100ms. |
| Sync fails partially (e.g., write error) | If the write fails, the error is logged but the app continues. The crontab remains in its previous state. This is acceptable — the next restart will retry. |

## Migration Plan

No migration needed. The sync is a new feature that runs alongside existing behavior. Jobs created via the `cronjob` tool will have their crontab entries updated on the next container restart. Existing crontab entries within the madz block will be preserved if they match the disk state, or updated if they diverge.

## Open Questions

1. **Should the sync log its actions** (added/removed/updated counts) to the console on startup? *Decision: Yes, at `info` level.*
2. **Should there be a `--dry-run` flag for the sync** during development? *Decision: No — not needed for this scope. The block-based approach is inherently safe.*
