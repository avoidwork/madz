## REMOVED Requirements

### Requirement: Keyboard Navigation (panel-based)
The system SHALL support panel-based keyboard navigation using Tab, Shift+Tab, and arrow keys to switch between the conversation, memory, skills, and settings panels.
**Reason**: The panel system is removed entirely per the blueprint's core tenet "no panels, no tabs, no switching." Panel navigation is replaced with command-based output in the conversation stream.
**Migration**: Users who need to inspect skills or memory should use `/skills` and `/memory` commands, which produce output in the conversation stream.

### Requirement: TUI Command Entry (colon syntax)
The system SHALL allow users to issue commands via a slash-syntax (`:command`) input mode for system control.
**Reason**: The blueprint specifies slash-syntax (`/command`) as the standard. The colon syntax is replaced by the new command registry.
**Migration**: Commands previously entered as `:provider set openai` should now be entered as `/provider set openai`.

## MODIFIED Requirements

### Requirement: Startup Banner Display
The system SHALL display a BBS-style startup banner with ASCII art and a built-in command help menu when the TUI enters interactive mode. The banner SHALL also display the application version string below the ASCII art.
**Changes**: The banner now dismisses on Escape key press (which exits the app) in addition to any other key press.

#### Scenario: Banner dismisses on Escape key
- **WHEN** the banner is displayed and the user presses Escape
- **THEN** the system exits the application entirely
