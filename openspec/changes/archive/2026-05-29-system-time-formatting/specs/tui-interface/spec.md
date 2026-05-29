## MODIFIED Requirements

### Requirement: TUI Command Entry
The system SHALL display conversation timestamps using the system's default locale via `Intl.DateTimeFormat`, cached in a module-level constant. The formatter must use `{ hour: "numeric", minute: "2-digit" }` options and must NOT be recreated per message render.

#### Scenario: Timestamp uses localized format
- **WHEN** a message is rendered in the conversation panel
- **THEN** the timestamp is formatted by `Intl.DateTimeFormat` with the system default locale (e.g., `2:30 PM` on en-US, `14:30` on de-DE)

#### Scenario: Formatter is cached
- **WHEN** multiple messages are rendered in the same TUI process
- **THEN** only one `Intl.DateTimeFormat` instance is created (module-level constant), reused for all calls
