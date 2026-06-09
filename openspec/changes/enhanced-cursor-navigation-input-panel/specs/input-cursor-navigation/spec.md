## ADDED Requirements

### Requirement: Arrow Key Cursor Navigation
The system SHALL allow the user to move the cursor left and right through the input text using the `ArrowLeft` and `ArrowRight` keyboard keys.

#### Scenario: Move cursor right
- **WHEN** the user presses the `ArrowRight` key while the input panel is active and the cursor position is less than the text length
- **THEN** the cursor position increments by one character

#### Scenario: Move cursor left
- **WHEN** the user presses the `ArrowLeft` key while the input panel is active and the cursor position is greater than zero
- **THEN** the cursor position decrements by one character

#### Scenario: Cursor position bounded at text length
- **WHEN** the user presses `ArrowRight` and the cursor position equals the text length
- **THEN** the cursor position remains unchanged

#### Scenario: Cursor position bounded at zero
- **WHEN** the user presses `ArrowLeft` and the cursor position is zero
- **THEN** the cursor position remains unchanged

### Requirement: Character-Aware Insertion at Cursor Position
The system SHALL insert typed characters at the current cursor position, shifting existing text to the right, rather than always appending at the end.

#### Scenario: Insert character within text
- **WHEN** the cursor position is between two characters and the user types a character
- **THEN** the new character is inserted at the cursor position and the cursor position advances by one

#### Scenario: Insert character at end of text
- **WHEN** the cursor position equals the text length and the user types a character
- **THEN** the new character is appended to the end of the text

#### Scenario: Insert character at beginning of text
- **WHEN** the cursor position is zero and the user types a character
- **THEN** the new character is inserted at the beginning of the text

### Requirement: Character-Aware Backspace at Cursor Position
The system SHALL delete the character to the left of the cursor position when the user presses backspace, and adjust the cursor position accordingly.

#### Scenario: Backspace within text
- **WHEN** the cursor position is greater than zero and the user presses backspace
- **THEN** the character immediately to the left of the cursor is deleted, remaining text shifts left, and the cursor position decrements by one

#### Scenario: Backspace at text start
- **WHEN** the cursor position is zero and the user presses backspace
- **THEN** no character is deleted and the cursor position remains unchanged

#### Scenario: Backspace replaces single character
- **WHEN** the user types a character, moves the cursor left, and presses backspace
- **THEN** the originally typed character is removed and the cursor position returns to its prior value

### Requirement: Cursor Position Visual Highlight
The system SHALL render a visual highlight (background color matching the cursor color with inverted/high-contrast text) on the character at the current cursor position.

#### Scenario: Highlight appears on cursor key press
- **WHEN** the user presses an arrow key to move the cursor to a new position
- **THEN** the character at the new cursor position is rendered with a background color matching the cursor color

#### Scenario: Highlight text inverts for contrast
- **WHEN** a character is highlighted at the cursor position
- **THEN** the character's text color is inverted or set to a high-contrast color against the cursor background

#### Scenario: Highlight follows cursor movement
- **WHEN** the user moves the cursor multiple positions with repeated arrow key presses
- **THEN** the highlight updates to follow the cursor position on each keystroke without terminal flicker

#### Scenario: No highlight on empty input
- **WHEN** the input text is empty (cursor position is zero) and arrow keys are pressed
- **THEN** no character highlight is rendered (cursor position is zero, no character exists to highlight)

#### Scenario: Highlight renders without affecting text layout
- **WHEN** the cursor highlight is active on a character
- **THEN** the rendered input line maintains the same width and no layout shift occurs

## REMOVED Requirements

### Requirement: Single Character Insertion at Text End
**Reason**: Replaced by cursor-position-aware insertion at `specs/input-cursor-navigation/spec.md`

**Migration**: Users retain identical behavior when the cursor position remains at the text end (the default). All existing insert workflows are preserved; insertion simply operates at `cursorPosition` instead of being hardcoded to `inputText.length`.

### Requirement: End-of-Text Backspace Only
**Reason**: Replaced by cursor-position-aware backspace at `specs/input-cursor-navigation/spec.md`

**Migration**: Backspace retains identical behavior when cursor position equals text length. Backspace at arbitrary positions now deletes the character to the left of the cursor instead of the last character.
