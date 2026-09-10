# tui-config Specification

## Purpose
TBD - created by archiving change config-option-suppress-toolcalldisplay. Update Purpose after archive.
## Requirements
### Requirement: TUI tool result display suppression
The system SHALL provide a `tui.showToolResults` configuration option that controls whether tool call result lines are displayed in assistant message bubbles.

#### Scenario: showToolResults is true (default)
- **WHEN** `tui.showToolResults` is `true` or not set
- **THEN** the assistant message bubble SHALL display tool call result lines (`toolCallDisplay`) in gray text below the active tool call indicator

#### Scenario: showToolResults is false
- **WHEN** `tui.showToolResults` is set to `false`
- **THEN** the assistant message bubble SHALL NOT display tool call result lines (`toolCallDisplay`)

#### Scenario: activeToolCall remains visible when showToolResults is false
- **WHEN** `tui.showToolResults` is `false` and a tool is currently running
- **THEN** the "Running: {name} ..." indicator SHALL still be displayed

#### Scenario: completedToolCalls remains visible when showToolResults is false
- **WHEN** `tui.showToolResults` is `false` and tool calls have completed
- **THEN** the "⚡ N tool calls: ..." summary SHALL still be displayed

