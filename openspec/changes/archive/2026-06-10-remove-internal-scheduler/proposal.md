## Why

The `cronjob` tool saves jobs to `memory/schedules/*.json` — no crontab entries are created. Jobs are orphaned: created but never scheduled, deleted but crontab entry persists. Furthermore, the current design forces every crontab entry to point back to `madz --run-schedule`, defeating the purpose of offloading execution to the host system. Users need the flexibility to run arbitrary commands or scripts directly via `crond`.

## What Changes

- **Rename** `CronInstaller` → `Cron` — its job is managing crontab entries via CRUD ops (`add()`, `remove()`, `list()`), not just installing.
- **Add** `command` field to job schema in `memory/schedules/*.json`.
- **Modify** `Cron.add(job)` to write the exact `job.command` string to the crontab block, removing the automatic `madz --run-schedule` wrapper.
- **Add** `Cron.remove(name)` — deletes a single cron entry by name from the crontab block. Note: already handles memory file deletion in cronjob tool; `Cron.remove()` handles only the crontab entry.
- **Add** `Cron.list()` — reads current crontab entries (already exists but should be public API).
- **Update** `cronjob` tool (`src/tools/cron.js`) to accept and pass `command` during `create`/`update`, and call `Cron.add()`/`Cron.remove()`.
- **Remove** ScheduleManager's clock tick loop (`start()`, `stop()`, `#clockTick()`, `#tickId`) — host crond handles execution timing.
- **Remove** `src/scheduler/queue.js`, `runner.js`, `logger.js`, `matcher.js`, `parser.js` — only used by the removed loop.
- Keep ScheduleManager CRUD ops (`register`, `list`, `pause`, `resume`, `runNow`) and `Cron` — they manage jobs independently of the removed loop.
- Keep TUI `:schedule` commands, `index.js` wiring.
- Update `src/scheduler/scheduler.js` to remove the loop methods and their imports.
- Update `src/scheduler/index.js` to remove the deleted module exports.

No breaking user-facing changes.
