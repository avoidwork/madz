## MODIFIED Requirements

### Requirement: Startup Banner Display
The system SHALL display a BBS-style startup banner with ASCII art and a built-in command help menu when the TUI enters interactive mode. The banner SHALL also display the application version string below the ASCII art.

#### Scenario: Banner renders on TUI launch
- **WHEN** the user starts the app in interactive mode (`--mode interactive`)
- **THEN** the system renders a banner containing ASCII art (project logo), the application version string below the ASCII art, and a grouped list of available commands before showing the conversation panel

#### Scenario: Banner dismisses on any key press
- **WHEN** the banner is displayed and the user presses any key
- **THEN** the system hides the banner and immediately displays the normal chat interface with the conversation panel and input bar

#### Scenario: Banner does not appear in CLI mode
- **WHEN** the user runs the app in chat/batch mode (without `--mode interactive`)
- **THEN** the system does not render the banner
