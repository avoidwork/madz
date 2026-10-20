## ADDED Requirements

### Requirement: Env-var overrides reach surfaced config keys
The system SHALL resolve environment-variable overrides for the surfaced config keys through the schema-driven reverse map, so that setting an env var materializes the corresponding config path.

#### Scenario: MEMORY_MAX_ENTRIES env var reaches memory.maxEntries
- **WHEN** `MEMORY_MAX_ENTRIES` is set in the environment and `memory.maxEntries` is absent from `config.yaml`
- **THEN** `syncEnv()` materializes `memory.maxEntries` with the env-var value

#### Scenario: CALENDAR_ACTIVE env var reaches calendar.active
- **WHEN** `CALENDAR_ACTIVE` is set in the environment and `calendar.active` is absent from `config.yaml`
- **THEN** `syncEnv()` materializes `calendar.active` with the env-var value

#### Scenario: TUI_STATUS_BAR_PROJECT env var reaches tui.statusBar.project
- **WHEN** `TUI_STATUS_BAR_PROJECT` is set in the environment and `tui.statusBar.project` is absent from `config.yaml`
- **THEN** `syncEnv()` materializes `tui.statusBar.project` with the env-var value

#### Scenario: SCHEDULES_LOG_PATH env var reaches schedules.logPath
- **WHEN** `SCHEDULES_LOG_PATH` is set in the environment and `schedules.logPath` is absent from `config.yaml`
- **THEN** `syncEnv()` materializes `schedules.logPath` with the env-var value
