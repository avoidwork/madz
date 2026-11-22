# Spec Delta

## ADDED Requirements

### Requirement: /system command SHALL switch to the system panel

The system SHALL route the `/system` slash command as a view-switching command that opens the system info panel, and SHALL treat it as a pure panel switch that does not interrupt an in-flight stream.

#### Scenario: User opens the system panel via command

- **WHEN** user types `/system` in command mode
- **THEN** the system returns a view action routing to the `system` panel

#### Scenario: /system is treated as a pure view switch

- **WHEN** user types `/system` while a stream is in flight
- **THEN** the system treats it as a pure panel switch and does not interrupt the in-flight stream
