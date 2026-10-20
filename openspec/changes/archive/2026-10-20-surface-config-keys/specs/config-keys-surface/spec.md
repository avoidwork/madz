## ADDED Requirements

### Requirement: Config keys surfaced in config.yaml
The system SHALL document five config keys in `config.yaml` that are read by live code but were previously absent: `calendar.active`, `providers.fal`, `memory.maxEntries`, `tui.statusBar.project`, and `schedules.logPath`. Each key SHALL be present with its current effective default so the knob is discoverable and configurable through the single source of truth.

#### Scenario: calendar.active is present with default google
- **WHEN** `config.yaml` is loaded
- **THEN** `calendar.active` is present and defaults to `"google"`, matching the fallback `calendarConfig.active || "google"` in `src/tools/calendar/providers/factory.js`

#### Scenario: providers.fal is documented as an optional backend
- **WHEN** `config.yaml` is loaded
- **THEN** `providers.fal` is present as a documented (commented-out) optional backend that gates `generateImage` registration, and is not an empty stub implying it is configured

#### Scenario: memory.maxEntries is present with default 100
- **WHEN** `config.yaml` is loaded
- **THEN** `memory.maxEntries` is present and defaults to `100`, matching the fallback `config.memory.maxEntries || 100` in `src/tools/memory/index.js`

#### Scenario: tui.statusBar.project is present with default true
- **WHEN** `config.yaml` is loaded
- **THEN** `tui.statusBar.project` is present and defaults to `true`, matching the fallback `statusBar.project !== false` in `src/tui/statusBar.js`

#### Scenario: schedules.logPath is present
- **WHEN** `config.yaml` is loaded
- **THEN** `schedules.logPath` is present, matching the fallback `if (config.schedules.logPath)` in `index.js`

### Requirement: Omitting a key preserves existing behavior
The system SHALL preserve existing behavior when any of the five surfaced keys is omitted from `config.yaml`, because the code fallbacks remain in place.

#### Scenario: Omitting calendar.active falls back to google
- **WHEN** `calendar.active` is omitted from `config.yaml`
- **THEN** the calendar factory selects `GoogleCalendarProvider`, identical to today's behavior

#### Scenario: Omitting memory.maxEntries falls back to 100
- **WHEN** `memory.maxEntries` is omitted from `config.yaml`
- **THEN** the memory tool uses a default of 100 entries, identical to today's behavior

#### Scenario: Omitting tui.statusBar.project shows the project segment
- **WHEN** `tui.statusBar.project` is omitted from `config.yaml`
- **THEN** the status bar shows the project segment, identical to today's behavior

#### Scenario: Omitting schedules.logPath skips log path configuration
- **WHEN** `schedules.logPath` is omitted from `config.yaml`
- **THEN** the scheduler does not set a log path, identical to today's behavior

### Requirement: calendar.active msgraph selects MsGraphProvider
The system SHALL select `MsGraphProvider` when `calendar.active` is set to `msgraph`.

#### Scenario: calendar.active msgraph selects MsGraphProvider
- **WHEN** `calendar.active` is set to `"msgraph"` in `config.yaml`
- **THEN** the calendar factory returns an `MsGraphProvider` instance
