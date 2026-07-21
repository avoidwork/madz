## MODIFIED Requirements

### Requirement: Blinking Input Cursor
The system SHALL render a cursor indicator at the end of the input text in the chat input panel, delegated to the `ink-text-input` component. The cursor SHALL blink at a configurable interval and use a configurable character.

#### Scenario: Cursor appears at end of input text
- **WHEN** the user types text in the input panel
- **THEN** a cursor character appears after the last character of the input text (rendered by ink-text-input)

#### Scenario: Cursor toggles visibility on interval
- **WHEN** the input panel is displayed with text
- **THEN** the cursor alternates between visible and invisible at a configurable interval (default 530ms), handled by ink-text-input

#### Scenario: Cursor uses configured character
- **WHEN** `tui.cursorChar` is set in config
- **THEN** the cursor displays using that character via ink-text-input props (default: `█`)

#### Scenario: Cursor is visible when input is empty
- **WHEN** the input panel is displayed with no text
- **THEN** the blinking cursor still appears (indicating the active input position), rendered by ink-text-input

#### Scenario: Cursor does not appear in banner mode
- **WHEN** the startup banner is being displayed
- **THEN** the blinking cursor is not rendered

### Requirement: Configurable Cursor Character
The `tui` configuration section SHALL support a `cursorChar` field that specifies the character used for the input cursor. The cursor rendering is delegated to `ink-text-input`.

#### Scenario: Accepts valid cursor character string
- **WHEN** `tui.cursorChar` is set to a non-empty string in config
- **THEN** the system passes that character to the input component as the cursor display

#### Scenario: Accepts unicode block character as default
- **WHEN** `tui.cursorChar` is not set in config
- **THEN** the system defaults to `█` (U+2588 FULL BLOCK)

#### Scenario: Rejects non-string cursor character
- **WHEN** `tui.cursorChar` is set to a non-string value
- **THEN** schema validation fails

### Requirement: Configurable Blink Interval
The `tui` configuration section SHALL support a `blinkTimeout` field specifying the cursor blink interval in milliseconds. The blink behavior is delegated to `ink-text-input`.

#### Scenario: Accepts valid blink timeout value
- **WHEN** `tui.blinkTimeout` is set to a positive integer in config
- **THEN** the system uses that interval for the cursor blink cycle via ink-text-input

#### Scenario: Accepts default blink timeout
- **WHEN** `tui.blinkTimeout` is not set in config
- **THEN** the system defaults to 530 milliseconds per blink cycle

#### Scenario: Rejects zero or negative blink timeout
- **WHEN** `tui.blinkTimeout` is set to zero or a negative value
- **THEN** schema validation fails

#### Scenario: Rejects non-integer blink timeout
- **WHEN** `tui.blinkTimeout` is set to a non-integer value (e.g., 3.5)
- **THEN** schema validation fails
