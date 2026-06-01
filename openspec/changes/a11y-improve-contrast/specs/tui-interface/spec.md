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
