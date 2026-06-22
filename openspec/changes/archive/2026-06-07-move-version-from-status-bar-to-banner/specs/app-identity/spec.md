## MODIFIED Requirements

### Requirement: App Identity Display
The system SHALL display the application version once in the startup banner, positioned below the ASCII art. The version is not displayed persistently anywhere else in the TUI.

#### Scenario: Version displayed in banner on TUI launch
- **WHEN** the user starts the app in interactive mode (`--mode interactive`)
- **THEN** the system renders a banner containing ASCII art and the application version string (e.g., `v1.2.3`) displayed below the ASCII art

#### Scenario: Banner dismisses on any key press
- **WHEN** the banner is displayed and the user presses any key
- **THEN** the system hides the banner and immediately displays the normal chat interface with the conversation panel and input bar, and the version is no longer shown

#### Scenario: Version is not displayed persistently
- **WHEN** the user is actively using the TUI in conversation mode
- **THEN** the application version is not visible in the status bar, input panel, or any persistent UI element

## REMOVED Requirements

### Requirement: App Identity Display (Input Panel)
**Reason**: Version display moved from persistent TUI location to the startup banner
**Migration**: The version is now shown once in the startup banner below the ASCII art.

### Requirement: Input Panel Right-Side Identity
**Reason**: The version is no longer displayed persistently in the input panel or status bar.
**Migration**: Use the startup banner version display or `--version` CLI flag if available.
