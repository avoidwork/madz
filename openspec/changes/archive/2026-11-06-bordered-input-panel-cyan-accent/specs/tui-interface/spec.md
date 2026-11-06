# Spec Delta

## MODIFIED Requirements

### Requirement: Interactive Chat Mode
The system SHALL provide an interactive conversational mode where users can type messages using an `ink-text-input` component, receive LLM responses, and view conversation history in a scrollable terminal buffer. The input panel SHALL be rendered inside a rounded cyan-bordered box (`borderStyle="round"`, `borderColor="cyan"`, `width="100%"`) with a cyan `>` prompt prefix rendered before the text input. The two-row layout SHALL be preserved: the status bar remains row 1 and the bordered input becomes row 2, with no third row added. The complete status bar SHALL remain present and unchanged.

#### Scenario: User sends a message and receives a response
- **WHEN** user types a message in the input panel (ink-text-input) and presses Enter
- **THEN** the system displays the user message followed by the LLM response in the conversation panel

#### Scenario: User scrolls through conversation history
- **WHEN** the conversation exceeds the visible terminal height
- **THEN** the user can scroll up to view prior messages using page-up/page-down or arrow keys

#### Scenario: Input panel renders inside a cyan-bordered box
- **WHEN** the TUI renders the input panel in interactive mode
- **THEN** the input panel is enclosed in a rounded box with a cyan border and a cyan `>` prompt prefix before the text input

#### Scenario: Two-row layout is preserved
- **WHEN** the TUI renders the bottom area in interactive mode
- **THEN** the status bar occupies the first row and the bordered input panel occupies the second row, with no additional row added

#### Scenario: Status bar remains complete and unchanged
- **WHEN** the TUI renders the status bar in interactive mode
- **THEN** all status bar elements (spinner, model, skill count, message count, context meter, token budget, project, quote, version) remain present and unchanged
