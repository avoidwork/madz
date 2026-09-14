## Context

The cron tool's `create` action accepts either a `skill` name or an explicit `command`. When only a `skill` is provided, the job is persisted with `command: undefined`. Two problems result:

1. `cronJobImpl`'s `create` action passes `command: job.command` (i.e. `undefined`) to `cronModule.add`, so the crontab entry is registered without a usable command.
2. `Cron._readJobsFromDisk` requires `job.name && job.cron && job.command` (line 504), so any job persisted with only a `skill` (no `command`) is silently skipped during crontab sync.

Meanwhile, `ScheduleManager.loadFromDisk` (`src/scheduler/scheduler.js`) already handles this case correctly: when a job has a `skill` field, it derives the command as `cd ${process.cwd()} && node index.js --message "Run the ${job.skill} skill"`.

## Goals / Non-Goals

**Goals:**
- Make the cron tool's `create` action derive a command from the skill name when no explicit command is given, mirroring `ScheduleManager.loadFromDisk`.
- Make `Cron._readJobsFromDisk` accept `job.skill` as an alternative to `job.command`, deriving the command the same way, so skill-only jobs are not silently skipped during crontab sync.
- Add unit tests covering the skill-only job case in both the cron tool and the scheduler cron module.

**Non-Goals:**
- Changing the cron tool's input schema or output format.
- Changing the derivation logic in `ScheduleManager.loadFromDisk`.
- Refactoring unrelated scheduler or cron code.

## Decisions

**Decision 1: Derive the command from the skill name in `cronJobImpl`'s `create` action.**
The derived command is `cd ${process.cwd()} && node index.js --message "Run the ${job.skill} skill"`, identical to the string used in `ScheduleManager.loadFromDisk`. This keeps the two code paths consistent. The derived command is stored on the job object (so it persists to disk) and passed to `cronModule.add`.

**Decision 2: Accept `job.skill` as an alternative to `job.command` in `_readJobsFromDisk`.**
The guard changes from `job.name && job.cron && job.command` to `job.name && job.cron && (job.skill || job.command)`. When a job has a `skill` field, the command is derived the same way as in `ScheduleManager.loadFromDisk`. This ensures skill-only jobs are included in the crontab sync.

**Decision 3: Keep the derivation logic duplicated rather than extracting a shared helper.**
The derivation string is a single line and already exists in two places (`ScheduleManager.loadFromDisk` and now `cronJobImpl`). Extracting a shared helper would be a larger refactor than the bug fix warrants, and the project's KISS/YAGNI principles favor minimal change. The string is kept identical across all three sites to avoid drift.

## Risks / Trade-offs

- **[Command string drift]** → The derived command string is duplicated across three sites (`ScheduleManager.loadFromDisk`, `cronJobImpl`, `_readJobsFromDisk`). Mitigation: keep the string byte-for-byte identical and add a test asserting the derived command matches the expected format.
- **[Behavior change for existing skill-only jobs]** → Jobs previously persisted with `command: undefined` will now be picked up by `_readJobsFromDisk` and registered in the crontab. This is the intended fix, but it means previously-skipped jobs will now start executing. Mitigation: this is the desired behavior per the issue.
