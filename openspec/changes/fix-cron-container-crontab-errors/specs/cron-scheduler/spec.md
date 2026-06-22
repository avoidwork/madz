## MODIFIED Requirements

### Requirement: Init-time Crontab Synchronization
The system SHALL automatically synchronize persisted job definitions from `memory/schedules/*.json` with the system crontab block on every container initialization, before the scheduler begins processing. The sync reconciles added, removed, updated, and paused jobs without interrupting any currently executing crond jobs. On container startup, `_readCrontab()` performs a best-effort read of the current crontab — if `crontab -l` fails for any reason (permission denied, binary not found, timeout, etc.), the function returns `""` and logs a debug-level message, allowing the sync to proceed as if no madz block exists.

#### Scenario: Sync runs on container init
- **WHEN** the application starts with `scheduler.syncOnInit` enabled (default `true`)
- **THEN** the system reads all JSON files from `memory/schedules/`, compares them against the current crontab block, and writes a reconciled block back

#### Scenario: New jobs are added to crontab
- **WHEN** a JSON file exists in `memory/schedules/` for a job not present in the crontab block
- **THEN** the system adds the job entry to the crontab block

#### Scenario: Removed jobs are deleted from crontab
- **WHEN** a job entry exists in the crontab block but no corresponding JSON file exists in `memory/schedules/`
- **THEN** the system removes the job entry from the crontab block

#### Scenario: Updated jobs are refreshed in crontab
- **WHEN** a job exists in both the crontab block and `memory/schedules/` but with differing cron expression or command
- **THEN** the system updates the crontab entry to match the JSON file

#### Scenario: Paused jobs are excluded from crontab
- **WHEN** a job has `enabled: false` in its JSON file
- **THEN** the system does not include the job in the crontab block and removes any existing entry

#### Scenario: No job duplication during sync
- **WHEN** the sync function writes the crontab
- **THEN** the system replaces the entire madz-schedules block rather than appending entries

#### Scenario: Sync does not interrupt running jobs
- **WHEN** the sync function executes
- **THEN** it performs only crontab read/write operations — no process signals are sent to crond or running jobs

#### Scenario: Sync can be disabled via config
- **WHEN** `scheduler.syncOnInit` is set to `false` in config
- **THEN** the system skips the init-time crontab synchronization

#### Scenario: crontab -l fails with non-"no crontab" error
- **WHEN** `crontab -l` fails with an error other than "no crontab" (e.g., permission denied, binary not found)
- **THEN** `_readCrontab()` returns `""` and logs a debug-level message
- **THEN** the sync operation proceeds as if no madz block exists, writing all jobs from `memory/schedules/`

#### Scenario: _readCrontab() never throws
- **WHEN** any error occurs during `crontab -l` execution
- **THEN** `_readCrontab()` returns `""` without throwing
- **THEN** the sync operation completes successfully