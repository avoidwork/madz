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

### Requirement: TUI overscan configuration option
The system SHALL provide a `tui.overscan` configuration option that controls how many messages are mounted beyond the viewport on each side in the virtualized scroll view. It SHALL be a non-negative integer, defaulting to 10.

#### Scenario: overscan defaults to 10
- **WHEN** `tui.overscan` is not set in config
- **THEN** the value defaults to 10

#### Scenario: overscan is a non-negative integer
- **WHEN** `tui.overscan` is set to a non-negative integer
- **THEN** the schema accepts it

#### Scenario: overscan rejects negative values
- **WHEN** `tui.overscan` is set to a negative integer
- **THEN** the schema rejects it

#### Scenario: overscan is threaded to MessageList
- **WHEN** the app renders the conversation panel
- **THEN** the `overscan` value is threaded through `app.js` → `ConversationArea` → `ConversationPanel` → `MessageList`

### Requirement: TUI mouse scroll lines configuration option
The system SHALL provide a `tui.mouseScrollLines` configuration option that controls how many lines the conversation panel scrolls per mouse wheel event. It SHALL be a positive integer, defaulting to 1.

#### Scenario: mouseScrollLines defaults to 1
- **WHEN** `tui.mouseScrollLines` is not set in config
- **THEN** the value defaults to 1

#### Scenario: mouseScrollLines is a positive integer
- **WHEN** `tui.mouseScrollLines` is set to a positive integer
- **THEN** the schema accepts it

#### Scenario: mouseScrollLines rejects zero
- **WHEN** `tui.mouseScrollLines` is set to 0
- **THEN** the schema rejects it

#### Scenario: mouseScrollLines rejects negative values
- **WHEN** `tui.mouseScrollLines` is set to a negative integer
- **THEN** the schema rejects it

#### Scenario: mouseScrollLines rejects non-integers
- **WHEN** `tui.mouseScrollLines` is set to a non-integer (e.g., 1.5)
- **THEN** the schema rejects it

### Requirement: TUI reasoning collapse configuration option
The system SHALL provide a `tui.reasoningCollapsed` configuration option that controls the initial collapse state of reasoning blocks in the TUI. It SHALL default to `true` (collapsed).

#### Scenario: reasoningCollapsed defaults to true
- **WHEN** `tui.reasoningCollapsed` is not set in config
- **THEN** the initial reasoning collapse state is `true` (collapsed)

#### Scenario: reasoningCollapsed is configurable
- **WHEN** `tui.reasoningCollapsed` is set to `false`
- **THEN** the initial reasoning collapse state is `false` (expanded)

### Requirement: TUI tool call collapse configuration option
The system SHALL provide a `tui.toolCallCollapsed` configuration option that controls the initial collapse state of tool result blocks in the TUI. It SHALL default to `true` (collapsed).

#### Scenario: toolCallCollapsed defaults to true
- **WHEN** `tui.toolCallCollapsed` is not set in config
- **THEN** the initial tool result collapse state is `true` (collapsed)

#### Scenario: toolCallCollapsed is configurable
- **WHEN** `tui.toolCallCollapsed` is set to `false`
- **THEN** the initial tool result collapse state is `false` (expanded)

