## ADDED Requirements

### Requirement: Config keys surfaced in config.yaml
The system SHALL include the five surfaced keys (`calendar.active`, `providers.fal`, `memory.maxEntries`, `tui.statusBar.project`, `schedules.logPath`) in `config.yaml` with their current effective defaults, and SHALL add the matching field to the relevant Zod schema under `src/config/schemas/` so env-var overrides resolve through `buildReverseMap()`.

#### Scenario: memory.maxEntries is added to MemorySchema
- **WHEN** `buildReverseMap(ConfigSchema)` is invoked
- **THEN** the reverse map contains `MEMORY_MAX_ENTRIES` mapped to `memory.maxEntries`

#### Scenario: calendar.active is in the schema
- **WHEN** `buildReverseMap(ConfigSchema)` is invoked
- **THEN** the reverse map contains `CALENDAR_ACTIVE` mapped to `calendar.active`

#### Scenario: tui.statusBar.project is in the schema
- **WHEN** `buildReverseMap(ConfigSchema)` is invoked
- **THEN** the reverse map contains `TUI_STATUS_BAR_PROJECT` mapped to `tui.statusBar.project`

#### Scenario: schedules.logPath is in the schema
- **WHEN** `buildReverseMap(ConfigSchema)` is invoked
- **THEN** the reverse map contains `SCHEDULES_LOG_PATH` mapped to `schedules.logPath`
