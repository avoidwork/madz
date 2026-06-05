## REMOVED Requirements

### Requirement: Blinking Input Cursor
**Reason**: Replaced by display-only input panel; cursor is handled by OpenTUI's native `<input>` or a static display
**Migration**: The animated blink interval is removed; the input panel simply displays text with a fixed cursor character

### Requirement: Configurable Blink Interval
**Reason**: Blink animation is removed as a display concern
**Migration**: The `tui.blinkTimeout` config field is no longer referenced by the input panel

### Requirement: Configurable Cursor Character
**Reason**: Cursor character display is kept but simplifies to a single configurable string
**Migration**: `tui.cursorChar` remains supported and continues to default to `█` (U+2588 FULL BLOCK)

## ADDED Requirements

### Requirement: Input panel displays text with static cursor display
The input panel SHALL display the user's current input text followed by a cursor character, without animation. The cursor character is configured via `tui.cursorChar`.

#### Scenario: Cursor character appears after input text
- **WHEN** the user types text in the input panel
- **THEN** the cursor character appears immediately after the last character

#### Scenario: Cursor is visible in empty input
- **WHEN** the input panel is displayed with no text
- **THEN** the cursor character still appears (indicating the active input position)
