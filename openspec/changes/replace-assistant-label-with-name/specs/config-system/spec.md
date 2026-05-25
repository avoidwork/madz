## ADDED Requirements

### Requirement: TUI Assistant Name Config
The system SHALL support a customizable assistant display label via a `tui.name` configuration field in `config.yaml`, defaulting to `"madz"`.

#### Scenario: Default assistant label
- **WHEN** `config.yaml` does not contain a `tui` section
- **THEN** the TUI chat log shows `"madz"` as the assistant role label

#### Scenario: Custom assistant label from config
- **WHEN** `config.yaml` sets `tui.name` to `"oracle"`
- **THEN** the TUI chat log shows `"oracle"` as the assistant role label

#### Scenario: Custom label via runtime mutation
- **WHEN** the user types `:config set tui.name sentinel` in command mode
- **THEN** the system updates the in-memory config, persists to `config.yaml`, and the chat log shows `"sentinel"` as the assistant label
