## 1. Add sync method to Cron class

- [ ] 1.1 Add `sync()` method to `src/scheduler/cron.js` that reads all JSON files from `memory/schedules/`, compares against the current crontab block, and writes a reconciled block
- [ ] 1.2 The `sync()` method must handle: new jobs (add), removed jobs (delete), updated jobs (replace), paused jobs (exclude)
- [ ] 1.3 The `sync()` method must use full block replacement to prevent duplicates
- [ ] 1.4 The `sync()` method must NOT send signals to crond or kill any processes

## 2. Add config flag for sync control

- [ ] 2.1 Add `syncOnInit: true` to the `schedules:` section in `config.yaml`
- [ ] 2.2 Ensure the config loader reads `schedules.syncOnInit` with a default of `true`

## 3. Wire sync into application boot sequence

- [ ] 3.1 In `index.js`, after loading config and before TUI/agent initialization, call the sync function if `config.schedules.syncOnInit !== false`
- [ ] 3.2 The sync call must be synchronous to ensure crontab is consistent before any scheduled job could fire
- [ ] 3.3 Wrap the sync in a try/catch — if it fails, log at warn level and continue startup

## 4. Add logging for sync operations

- [ ] 4.1 Log an info-level message on sync start: `"Syncing crontab from disk: X jobs found"`
- [ ] 4.2 Log an info-level message on sync completion with counts: `"Crontab sync complete: +A added, -R removed, ~U updated, =S skipped"`
- [ ] 4.3 Log a warn-level message if the sync fails, including the error message

## 5. Write unit tests for the sync function

- [ ] 5.1 Test: sync adds a job that exists on disk but not in crontab
- [ ] 5.2 Test: sync removes a job that exists in crontab but not on disk
- [ ] 5.3 Test: sync updates a job with differing cron expression
- [ ] 5.4 Test: sync updates a job with differing command
- [ ] 5.5 Test: sync excludes paused jobs from crontab
- [ ] 5.6 Test: sync produces identical crontab on repeated calls (idempotent)
- [ ] 5.7 Test: sync preserves lines outside the madz block
- [ ] 5.8 Test: sync handles empty schedules directory
- [ ] 5.9 Test: sync handles empty crontab
- [ ] 5.10 Test: sync handles jobs with no command field (skips them)

## 6. Integration: verify end-to-end flow

- [ ] 6.1 Test: create a job via cronjob tool, restart container, verify job appears in crontab
- [ ] 6.2 Test: remove a job via cronjob tool, restart container, verify job is removed from crontab
- [ ] 6.3 Test: update a job's cron expression via cronjob tool, restart container, verify updated cron in crontab
- [ ] 6.4 Test: disable sync via config, verify no crontab changes on restart
