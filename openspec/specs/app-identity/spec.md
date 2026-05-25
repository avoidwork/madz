## ADDED Requirements

### Requirement: App Identity Display
The system SHALL display the application name and version pinned to the far right edge of the TUI input panel, with the input text filling all available space between the prompt and the identity label.

#### Scenario: Default app name and version displayed
- **WHEN** the TUI renders the input panel in interactive mode
- **THEN** the system displays `> ` followed by the user input text filling available space, then an empty space where the text ended, then `madz` in cyan, then `v1.0.0` in white, pinned to the right edge of the terminal

#### Scenario: Identity pinned right regardless of input length
- **WHEN** the user types a short input (e.g., `hi`) and a long input (e.g., `this is a very long message that extends far`)
- **THEN** the identity label remains fixed at the far right edge of the terminal in both cases

#### Scenario: Custom app name from config
- **WHEN** `config.tui.name` is set to a different value (e.g., `"oracle"`)
- **THEN** the system displays the input text filling space, followed by `<custom-name>` in cyan and `v1.0.0` in white pinned to the right

#### Scenario: Version reflects package.json
- **WHEN** the application version in `package.json` is updated
- **THEN** the displayed version matches the `package.json` version

#### Scenario: Short input with space-padded identity
- **WHEN** the user input is shorter than terminal width
- **THEN** the remaining space between the input text and the identity label is empty (space-padded)

### Requirement: Input Panel Right-Side Identity
The application name and version SHALL be rendered as the rightmost elements in the input panel, with flexbox grow allocated to the input text element.

#### Scenario: Right-side positioning with command mode
- **WHEN** the user is in command mode typing `:quit`
- **THEN** the system displays `: ` at the left, the input text filling available space, and the identity label pinned to the right

#### Scenario: App name styled cyan, version styled white
- **WHEN** the identity label is rendered
- **THEN** the app name is rendered using the `color` prop `"cyan"` and the version is rendered using the `color` prop `"white"`

#### Scenario: Input text uses flex grow
- **WHEN** the input panel renders its children
- **THEN** the input Text component has `flex: { grow: 1 }` (or Ink equivalent) to fill remaining space between the prompt and the identity label
