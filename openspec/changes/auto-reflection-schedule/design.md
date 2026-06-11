## Context

The application currently has two independent flows:
1. **Profile creation** — handled by `Onboarding.save()` in `src/session/onboarding.js`, which calls `saveProfile()` from `src/memory/profile.js`.
2. **Cron job management** — handled by the cron-scheduler system, which reads job definitions from `memory/schedules/*.json` and syncs them to the system crontab on startup.

There is no connection between these flows. A user who completes onboarding never automatically gets a daily reflection job, even though the reflection is a core part of the system's value proposition.

## Goals / Non-Goals

**Goals:**
- Auto-detect when a user's first `profile.md` is created on disk.
- Automatically register a daily 2am cron job that runs `node index.js --chat "/reflection"` in the app's working directory.
- Ensure the job is synced to the system crontab on next container start via the existing `syncOnInit` mechanism.

**Non-Goals:**
- Modifying the cron job command or schedule after creation.
- Supporting multiple reflection jobs or custom schedules.
- Handling profile updates (only first-write triggers the job).
- Modifying the in-process scheduler — the job is purely file-based, managed by `crond`.

## Decisions

### Decision 1: Hook into `saveProfile()` with a callback
Instead of modifying `saveProfile()`'s signature, we create a new module `src/scheduler/autoSchedule.js` that wraps the save operation. The module exposes `setupAutoSchedule()` which returns a callback. This callback is passed to `Onboarding` and invoked after `saveProfile()` succeeds.

**Rationale**: Keeps `saveProfile()` unchanged (no API break), provides a clean separation of concerns, and allows the callback to be optional (existing callers don't need changes).

### Decision 2: Embed working directory in the command string
The cron job command is `cd /<cwd> && node index.js --chat "/reflection"`, where `<cwd>` is captured from `process.cwd()` at profile creation time.

**Rationale**: 
- Simplest approach — no schema changes to job definitions.
- The existing scheduler's `_readJobsFromDisk()` reads `name`, `cron`, and `command` fields. No modification needed.
- Containerized deployments don't move, so the embedded path is stable.
- If the app is relocated, the user can edit the command via TUI or delete and recreate the job.

### Decision 3: Job name `reflection-daily` with idempotent creation
The job is written to `memory/schedules/reflection-daily.json`. The write is idempotent — if the file already exists, we skip creation (guarding against double-trigger).

**Rationale**: Prevents duplicate jobs if the save callback fires more than once. The existing crontab sync replaces entries by name, so duplicates in the JSON would be harmless but messy.

### Decision 4: First-write detection via `hasProfile()` check
Before saving, check `hasProfile()`. If `false`, this is a first write and we trigger the cron job creation.

**Rationale**: Simple, uses existing API, no filesystem race conditions (the check and save happen in the same synchronous flow).

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Container restart before cron job is synced | `syncOnInit` runs on every startup, so the job will be installed on the next start. No data loss. |
| `process.cwd()` differs in Docker vs local dev | The cwd is captured at profile creation time, so it matches the actual execution context. |
| User skips onboarding — no profile, no job | Correct behavior — no profile means no user to reflect for. |
| Job created but crontab unavailable | The job JSON still exists in `memory/schedules/`. It will be synced when crontab becomes available. |

## Migration Plan

No migration needed. This is a new capability that activates only on first profile creation. Existing installations with profiles already in place are unaffected.

## Open Questions

1. Should the job include a `workingDirectory` field for future flexibility, or keep it embedded in the command? (Decision: embedded, simpler now.)
2. Should the user be notified when the job is created? (Decision: no notification — silent, automatic.)
