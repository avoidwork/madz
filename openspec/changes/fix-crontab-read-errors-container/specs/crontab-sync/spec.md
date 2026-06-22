## ADDED Requirements

### Requirement: Graceful handling of empty or unreadable crontab
The system SHALL handle the case where `crontab -l` fails for any reason (empty crontab, permission denied, binary not found, etc.) by treating it as an empty crontab and proceeding with the sync or install operation.

#### Scenario: Empty crontab in fresh container
- **WHEN** `crontab -l` fails with an error that is not "no crontab" (e.g., empty crontab in fresh container)
- **THEN** the system treats the crontab as empty and proceeds to write the madz-schedules block

#### Scenario: Unreadable crontab
- **WHEN** `crontab -l` fails with a permission denied or other error
- **THEN** the system treats the crontab as empty and proceeds to write the madz-schedules block

#### Scenario: Crontab binary not found
- **WHEN** `crontab -l` fails because the crontab binary is not found
- **THEN** the system treats the crontab as empty and proceeds to write the madz-schedules block (if the binary is later made available)