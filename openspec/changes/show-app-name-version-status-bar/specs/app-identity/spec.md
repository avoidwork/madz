## ADDED Requirements

### Requirement: App Identity Display
The system SHALL display the application name and version on the right side of the TUI input panel, to the right of the user input text, separated by a single space.

#### Scenario: Default app name and version displayed
- **WHEN** the TUI renders the input panel in interactive mode
- **THEN** the system displays `> ` followed by the user input text, then a space, then `madz` in cyan, then a space, then `v1.0.0` in white

#### Scenario: Custom app name from config
- **WHEN** `config.tui.name` is set to a different value (e.g., `"oracle"`)
- **THEN** the system displays the user input followed by `<custom-name>` in cyan and `v1.0.0` in white on the right

#### Scenario: Version reflects package.json
- **WHEN** the application version in `package.json` is updated
- **THEN** the displayed version matches the `package.json` version

#### Scenario: Empty input still shows identity
- **WHEN** the input panel has no user text
- **THEN** the system still displays the prompt `> ` and the identity label on the right side

### Requirement: Input Panel Right-Side Identity
The application name and version SHALL be rendered as the rightmost elements in the input panel, following the user input text, with the prompt character remaining on the left.

#### Scenario: Right-side positioning with command mode
- **WHEN** the user is in command mode typing `:quit`
- **THEN** the system displays `: ` at the left, the input text in the middle, and the identity label on the right

#### Scenario: App name styled cyan, version styled white
- **WHEN** the identity label is rendered
- **THEN** the app name is rendered using the `color` prop `"cyan"` and the version is rendered using the `color` prop `"white"`
