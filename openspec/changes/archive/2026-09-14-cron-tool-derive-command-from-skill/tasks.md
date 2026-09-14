## 1. Derive command from skill in cron tool create action

- [x] 1.1 In `src/tools/cron/index.js`, in `cronJobImpl`'s `create` action, derive a command from the skill name when no explicit `command` is provided: `const command = job.command || \`cd ${process.cwd()} && node index.js --message "Run the ${job.skill} skill"\`;`
- [x] 1.2 Store the derived command on the job object so it persists to disk
- [x] 1.3 Pass the derived command to `cronModule.add` instead of `job.command`

## 2. Accept skill-only jobs in scheduler cron sync

- [x] 2.1 In `src/scheduler/cron.js`, in `_readJobsFromDisk`, change the guard to accept `job.skill` as an alternative to `job.command`: `if (job.name && job.cron && (job.skill || job.command))`
- [x] 2.2 Derive the command from the skill name when `job.skill` is present and `job.command` is absent, mirroring `ScheduleManager.loadFromDisk`

## 3. Add unit tests

- [x] 3.1 Add a test in `tests/unit/tools_cron.test.js` verifying that creating a job with only a `skill` derives and persists a command
- [x] 3.2 Add a test in `tests/unit/scheduler/cron.test.js` verifying that `_readJobsFromDisk` reads a skill-only job and derives its command
