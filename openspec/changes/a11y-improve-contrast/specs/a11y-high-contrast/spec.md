## ADDED Requirements

### Requirement: Configurable conversation panel background color
The system SHALL allow users to set a custom background color for the conversation panel via the `tui.backgroundColor` config key. The default value shall be `#1e1e1e`.

#### Scenario: Default gray background renders
- **WHEN** the TUI starts with no `tui.backgroundColor` set
- **THEN** the conversation panel renders with background color `#1e1e1e`

#### Scenario: Custom background color renders
- **WHEN** `tui.backgroundColor` is set to a valid hex color in config
- **THEN** the conversation panel renders with that exact background color

### Requirement: High-contrast mode config flag
The system SHALL provide a `tui.highContrast` boolean config option that, when set to `true`, enables high-contrast text rendering across all TUI panels.

#### Scenario: High-contrast is off by default
- **WHEN** `tui.highContrast` is not set or set to `false`
- **THEN** the TUI renders with default (current) color scheme

#### Scenario: High-contrast is enabled
- **WHEN** `tui.highContrast` is set to `true` in config
- **THEN** the TUI replaces gray/dim text with white bold text, adds text labels to status indicators, and applies role-specific background tints to message bubbles

### Requirement: High-contrast text rendering
In high-contrast mode, the system SHALL replace low-contrast gray and dim text with white bold text. This applies to timestamps, tool call results, thinking text, separator lines, and the "Press any key to continue..." banner text.

#### Scenario: Timestamps become white bold
- **WHEN** high-contrast mode is enabled
- **THEN** timestamps in message bubbles render as white text with bold styling instead of gray

#### Scenario: Tool call output becomes white bold
- **WHEN** high-contrast mode is enabled
- **THEN** tool call display lines ("Result:", "Running:") render as white text with bold styling instead of gray

#### Scenario: Thinking text becomes white bold
- **WHEN** high-contrast mode is enabled
- **THEN** "(thinking)" labels render as white text with bold styling instead of gray dim text

#### Scenario: System messages become white bold
- **WHEN** high-contrast mode is enabled
- **THEN** system role messages render with white bold text instead of yellow

### Requirement: High-contrast status indicators
In high-contrast mode, the system SHALL add text labels alongside colored status indicator symbols to make status readable without color perception.

#### Scenario: OK status shows label
- **WHEN** status is "Ready" or "Received response" and high-contrast is enabled
- **THEN** the status bar displays the symbol + "OK" text label

#### Scenario: Sending status shows label
- **WHEN** status starts with "Sending" or "Streaming" and high-contrast is enabled
- **THEN** the status bar displays the symbol + "SEND" text label

#### Scenario: Error status shows label
- **WHEN** status starts with "Error" and high-contrast is enabled
- **THEN** the status bar displays the symbol + "ERROR" text label

### Requirement: Role-specific bubble backgrounds
In high-contrast mode, the system SHALL apply subtle background color tints to message bubble containers to differentiate roles beyond border color alone.

#### Scenario: User message has tinted background
- **WHEN** high-contrast mode is enabled and a user message is displayed
- **THEN** the user message bubble container has a light blue-gray background (#2a2a2a tint)

#### Scenario: Assistant message has tinted background
- **WHEN** high-contrast mode is enabled and an assistant message is displayed
- **THEN** the assistant message bubble container has a slightly darker gray background (#252525 tint)

#### Scenario: System message has tinted background
- **WHEN** high-contrast mode is enabled and a system message is displayed
- **THEN** the system message bubble container has a dark amber-gray background (#2a2420 tint)

## ADDED Requirements

### Requirement: Interactive Chat Mode - Accessible Background
The system SHALL provide a configurable background color for the conversation panel as part of the interactive chat mode, ensuring the chat area is visually separated from the terminal background.

#### Scenario: User sees conversation area with background
- **WHEN** the user is viewing the conversation panel
- **THEN** the conversation area renders with the configured background color (default: `#1e1e1e`)

## MODIFIED Requirements

### Requirement: Startup Banner Display
The system SHALL display a BBS-style startup banner with ASCII art and a built-in command help menu when the TUI enters interactive mode. When high-contrast mode is enabled, the banner text SHALL use white bold instead of white to increase contrast.

#### Scenario: Banner renders with high-contrast improvements
- **WHEN** the user starts the app in interactive mode with `tui.highContrast` enabled
- **THEN** the banner separator lines and "Press any key to continue..." text render as white bold for improved readability

### Requirement: Keyboard Navigation
The system SHALL support panel-based keyboard navigation using Tab, Shift+Tab, and arrow keys to switch between the conversation, memory, skills, and settings panels. When high-contrast mode is enabled, the focus indicator for each panel item SHALL use white bold text in addition to cyan border highlighting.

#### Scenario: Focus indicator is enhanced in high-contrast mode
- **WHEN** the user navigates skills/memory/settings panels with `tui.highContrast` enabled
- **THEN** the focused item text renders as white bold in addition to the existing cyan border highlight
