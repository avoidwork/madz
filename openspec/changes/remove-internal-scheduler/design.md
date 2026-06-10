## Context

The `cronjob` tool saves jobs to `memory/schedules/*.json` via CRUD ops (`create`, `update`, `pause`, `resume`, `remove`). The `CronInstaller` class writes all schedules into the system crontab as a block (`# --- BEGIN madz-schedules ---` / `# --- END madz-schedules ---`). The ScheduleManager class has a clock tick loop (`start()`, `stop()`, `#clockTick()`) that is being removed — only its CRUD ops (`register`, `list`, `pause`, `resume`) remain.

## Goals / Non-Goals

**Goals:**
- Rename `CronInstaller` → `Cron` and add CRUD ops: `add(job)`, `remove(name)`, `list()` (read-only passthrough to existing `list()`).
- `cronjob.create` calls `Cron.add(job)`. `cronjob.remove` calls `Cron.remove(name)`.
- Remove ScheduleManager's in-process clock tick loop.
- Remove supporting modules only used by the removed loop.

**Non-Goals:**
- Do not change how Cron writes crontab entries — it uses the existing madz-schedules block delimiters.
- Do not change JSON file format in `memory/schedules/`.

## Decisions

### 1. CronInstaller renamed to Cron with CRUD ops
**Decision**: Keep the existing crontab block management logic. Add methods:
- `add({ name, cron, ... })` — reads crontab, removes existing madz block, appends new entry, writes crontab back.
- `remove(name)` — reads crontab, removes madz block, writes back everything except the named entry.
- `list()` — reads crontab madz block and returns array of `{ name, cron }`.

**Rationale**: `install()` writes the entire block. `add()`/`remove()` operate on individual entries — each reads the full crontab, modifies the madz block, writes back. Safe because reads+writes are atomic, no race condition on the block level.

### 2. ScheduleManager clock tick loop removed
**Decision**: Remove `start()`, `stop()`, `#clockTick()`, `#tickId` from ScheduleManager. Keep CRUD methods.

**Rationale**: The loop polls `matchesCron()` and enqueues tasks into `ScheduleQueue` for sandbox execution. Host crond handles scheduling.

### 3. Supporting modules removed
**Decision**: Remove `queue.js`, `runner.js`, `logger.js`, `matcher.js`, `parser.js`.

**Rationale**: Only used by the removed clock tick loop.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| `add()` or `remove()` reading the full crontab | Single read+write cycle. Safe to call frequently. No race condition. |
