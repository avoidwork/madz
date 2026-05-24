## ADDED Requirements

### Requirement: Startup Banner Display
The TUI SHALL display a BBS-style startup banner with ASCII art and a command help menu on launch, dismissable by any key press, and only in interactive mode.

#### Scenario: Banner appears on interactive launch
- **WHEN** the TUI starts in interactive mode
- **THEN** the banner is displayed before the conversation panel

#### Scenario: Banner dismisses on key press
- **WHEN** the user presses any key while the banner is displayed
- **THEN** the banner is removed and the normal chat interface is shown
