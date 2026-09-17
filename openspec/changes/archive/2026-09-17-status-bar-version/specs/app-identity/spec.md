## MODIFIED Requirements

### Requirement: App Identity Display
The system SHALL display the application version once in the startup banner, positioned below the ASCII art. The system SHALL also display the application version persistently, right-aligned in the bottom status bar, when a version is provided.

#### Scenario: Version displayed in banner on TUI launch
- **WHEN** the user starts the app in interactive mode (`--mode interactive`)
- **THEN** the system renders a banner containing ASCII art and the application version string (e.g., `v1.2.3`) displayed below the ASCII art

#### Scenario: Banner dismisses on any key press
- **WHEN** the banner is displayed and the user presses any key
- **THEN** the system hides the banner and immediately displays the normal chat interface with the conversation panel and input bar

#### Scenario: Version displayed persistently in status bar
- **WHEN** the user is actively using the TUI in conversation mode and a version is provided
- **THEN** the application version is displayed right-aligned in the bottom status bar

#### Scenario: Version not displayed when absent
- **WHEN** the user is actively using the TUI in conversation mode and no version is provided
- **THEN** the application version is not visible in the status bar, input panel, or any persistent UI element
