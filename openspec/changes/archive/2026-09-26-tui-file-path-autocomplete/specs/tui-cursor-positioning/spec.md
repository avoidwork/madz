## ADDED Requirements

### Requirement: Terminal cursor delegated to picker while open
The system SHALL delegate real terminal cursor positioning to the file picker while the picker owns the input.

#### Scenario: Picker positions terminal cursor while open
- **WHEN** the file picker is open
- **THEN** the picker positions the terminal cursor at the current cursor position in the input text

#### Scenario: Terminal cursor hidden when picker closes
- **WHEN** the file picker closes
- **THEN** terminal cursor positioning returns to the InputPanel
