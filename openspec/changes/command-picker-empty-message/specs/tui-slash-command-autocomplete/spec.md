## MODIFIED Requirements

### Requirement: Command picker does not render an empty message when the filter has no matches
The system SHALL not render a " No matching commands." empty message below the input line when the command picker's filter matches no commands; the typed input line SHALL remain fully visible and unobscured.

#### Scenario: No empty message on a typo filter
- **WHEN** the user types a `/` token whose filter matches no commands (e.g. `/confg`)
- **THEN** the command picker renders nothing below the input line and the typed input line remains fully visible

#### Scenario: Empty message text is never present
- **WHEN** the command picker renders with a filter that matches no commands
- **THEN** the rendered output does not contain the text " No matching commands."

#### Scenario: Typed input line always renders
- **WHEN** the command picker renders with a filter that matches no commands
- **THEN** the typed input line is always rendered
