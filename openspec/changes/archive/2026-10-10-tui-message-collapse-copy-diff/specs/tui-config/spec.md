## MODIFIED Requirements

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
