## Why

The `cronjob` tool saves jobs to `memory/schedules/*.json` — no crontab entries are created. Jobs are orphaned: created but never scheduled, deleted but crontab entry persists.

## What Changes

- **Rename** `CronInstaller` → `Cron` — its job is managing crontab entries via CRUD ops (`add()`, `remove()`, `list()`), not just installing.
- **Add** `Cron.add(job)` — writes a single cron entry to the crontab block.
- **Add** `Cron.remove(name)` — deletes a single cron entry by name from the crontab block. Note: already handles memory file deletion in cronjob tool; `Cron.remove()` handles only the crontab entry.
- **Add** `Cron.list()` — reads current crontab entries (already exists but should be public API).
- **Update** `cronjob` tool (`src/tools/cron.js`) to call `Cron.add()` for `create` and `Cron.remove()` for `remove`.
- **Remove** ScheduleManager's clock tick loop (`start()`, `stop()`, `#clockTick()`, `#tickId`) — host crond handles execution timing.
- **Remove** `src/scheduler/queue.js`, `runner.js`, `logger.js`, `matcher.js`, `parser.js` — only used by the removed loop.
- Keep ScheduleManager CRUD ops (`register`, `list`, `pause`, `resume`, `runNow`) and `Cron` — they manage jobs independently of the removed loop.
- Keep config.yaml `schedules` section, TUI `:schedule` commands, `index.js` wiring.
- Update `src/scheduler/scheduler.js` to remove the loop methods and their imports.
- Update `src/scheduler/index.js` to remove the deleted module exports.

No breaking user-facing changes.

## Capabilities

### Modified Capabilities

- `cron-scheduler`: 
  - **MODIFIED**: Jobs created/removed via `cronjob` tool now register/unregister with system crontab via `Cron.add()`/`Cron.remove()`.
  - **REMOVED**: In-process schedule polling loop (`ScheduleManager.start/stop/clockTick`).

## Impact

| Area | Impact |
|------|--------|
| `src/tools/cron.js` | Calls `Cron.add()` on create, `Cron.remove()` on remove |
| `src/scheduler/scheduler.js` | Remove `start()`, `stop()`, `#clockTick()`, `#tickId` |
| `src/scheduler/queue.js` | Removed |
| `src/scheduler/runner.js` | Removed |
| `src/scheduler/logger.js` | Removed |
| `src/scheduler/matcher.js` | Removed |
| `src/scheduler/parser.js` | Removed |
| `src/scheduler/index.js` | Remove exports of deleted modules; rename CronInstaller → Cron |
| `tests/unit/scheduler.test.js` | Updated (loop tests removed) |
| `tests/unit/scheduler_runner.test.js` | Removed |
