## Why

When the container restarts or is updated, the in-memory schedule state is lost and crontab entries may become stale or out of sync with the persisted job definitions in `memory/schedules/`. This means scheduled jobs can silently stop firing, duplicate, or conflict with other crontab entries after a restart. We need a deterministic, safe sync mechanism that runs on container init to reconcile persisted job definitions with the system crontab — without interrupting any jobs currently executing.

## What Changes

- Add a `syncCrontabOnInit()` function that runs during application startup (before the TUI or agent loop begins)
- The sync function reads all persisted job JSON files from `memory/schedules/`, compares them against the current crontab block, and performs a live merge:
  - **Added jobs**: Jobs in `memory/schedules/` that are not in the crontab block get added
  - **Removed jobs**: Jobs in the crontab block that no longer have a JSON file get removed
  - **Updated jobs**: Jobs present in both but with differing cron/command get updated
  - **Paused jobs**: Jobs with `enabled: false` are excluded from the crontab block (already handled by `install()`, but the sync must also remove stale entries)
- **No duplication**: The sync uses the existing block-based crontab approach (`# --- BEGIN madz-schedules ---`) — it reads the block, replaces it entirely, and writes back. No entry is ever added twice.
- **No interruption**: The sync only manipulates the crontab file. It does not send signals to running crond processes or kill any running jobs. crond will pick up changes on its next minute-level scan.
- Add a config flag `scheduler.syncOnInit: true` (default `true`) to enable/disable the sync behavior.

## Capabilities

### New Capabilities
- `crontab-sync`: Automatic reconciliation of persisted job definitions with the system crontab on container init. Handles add, update, remove, and pause operations safely without interrupting running jobs.

### Modified Capabilities
- `cron-scheduler`: Adds a new requirement for init-time crontab synchronization. The existing scheduler spec gains a new "Init Sync" requirement.

## Impact

- **Code**: `src/scheduler/cron.js` — add `sync()` method or enhance `install()` to support live merge. `src/scheduler/scheduler.js` — add init hook. `index.js` — call sync during boot.
- **Config**: `config.yaml` — add `scheduler.syncOnInit` flag under `schedules:` section.
- **Tests**: New tests for the sync function covering add, remove, update, pause, and no-op scenarios.
- **Docker**: No changes needed — the sync runs within the Node.js process on startup, after crond is already running.
