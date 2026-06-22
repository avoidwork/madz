## ADDED Requirements

### Requirement: Command strings must be sanitized before crontab interpolation
The system MUST strip line-breaking characters (`\n`, `\r\n`, `\r`) from command strings before interpolating them into crontab entries to prevent crontab format injection.

#### Scenario: Normal command passes through unchanged
- **WHEN** a command contains only printable ASCII characters and spaces
- **THEN** the sanitized command is identical to the original

#### Scenario: Command with newlines is sanitized
- **WHEN** a command contains `\n` characters
- **THEN** the sanitized command has all `\n` characters removed

#### Scenario: Command with carriage returns is sanitized
- **WHEN** a command contains `\r` or `\r\n` sequences
- **THEN** the sanitized command has all `\r` and `\n` characters removed

#### Scenario: Shell special characters are preserved
- **WHEN** a command contains `$`, backticks, `|`, or `;`
- **THEN** the sanitized command preserves these characters unchanged

### Requirement: Sanitization applies to all crontab entry construction paths
The system MUST apply command sanitization in all code paths that construct crontab entries: `Cron.add()`, `Cron.install()`, and `Cron.sync()`.

#### Scenario: Sanitization in add()
- **WHEN** `Cron.add()` is called with a command containing newlines
- **THEN** the crontab entry is written with the sanitized command

#### Scenario: Sanitization in install()
- **WHEN** `Cron.install()` is called with schedules containing commands with newlines
- **THEN** all crontab entries are written with sanitized commands

#### Scenario: Sanitization in sync()
- **WHEN** `Cron.sync()` is called with jobs containing commands with newlines
- **THEN** the reconciled crontab block uses sanitized commands