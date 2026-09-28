## ADDED Requirements

### Requirement: Cursor rendered by picker while open
The system SHALL render the input cursor by the file picker (not `ink-text-input`) while the picker owns the input.

#### Scenario: Picker renders cursor while open
- **WHEN** the file picker is open
- **THEN** the picker renders the input text with a cursor indicator at the current cursor position

#### Scenario: InputPanel cursor not rendered while picker open
- **WHEN** the file picker is open
- **THEN** the `ink-text-input` cursor is not rendered (the InputPanel is unfocused)
