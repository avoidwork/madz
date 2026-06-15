# Input Cursor

## Requirements

### Requirement: Input panel uses real terminal cursor
The InputPanel component SHALL use Ink's `useCursor` hook to position a real terminal cursor after the typed input text, replacing the previous cosmetic Unicode block character approach.

#### Scenario: Cursor positioned after input text
- **WHEN** the user types text in the input panel
- **THEN** the terminal cursor appears immediately after the last character of the input text

#### Scenario: Cursor handles wide characters correctly
- **WHEN** the input text contains wide characters (CJK characters, emoji)
- **THEN** the cursor x-position is calculated using `string-width` to account for multi-byte character column width

#### Scenario: Cursor hidden when input is empty
- **WHEN** the input text is empty
- **THEN** the terminal cursor is hidden (not visible)

#### Scenario: Cursor visible when input has text
- **WHEN** the user types text in the input panel
- **THEN** the terminal cursor is visible and positioned after the last character

### Requirement: Input panel displays prompt prefix
The InputPanel component SHALL display a `> ` prompt prefix before the typed input text.

#### Scenario: Prompt prefix is displayed
- **WHEN** the input panel renders
- **THEN** the text `> ` appears before the input text

#### Scenario: Prompt prefix is always visible
- **WHEN** the input text is empty
- **THEN** the `> ` prompt prefix is still displayed

### Requirement: Blink component removed
The `Blink` component SHALL be removed from `inputPanel.js` as it is no longer needed with real cursor positioning.

#### Scenario: No Blink component in inputPanel.js
- **WHEN** `inputPanel.js` is inspected
- **THEN** no `Blink` function or component is exported or defined

### Requirement: cursorChar prop removed
The `cursorChar` prop SHALL be removed from the `InputPanel` component API.

#### Scenario: InputPanel accepts no cursorChar prop
- **WHEN** `InputPanel` is called
- **THEN** the `cursorChar` prop is not accepted or used

### Requirement: string-width dependency added
The `string-width` package SHALL be added to the project's production dependencies for accurate wide-character column width calculation.

#### Scenario: string-width is a production dependency
- **WHEN** `package.json` is inspected
- **THEN** `string-width` appears in the `dependencies` section
