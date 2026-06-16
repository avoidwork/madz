## ADDED Requirements

### Requirement: Cursor Visibility Management
The TUI SHALL use Ink's `useCursor` hook to manage cursor visibility based on input focus state. When input is focused, the cursor SHALL be shown at the input position. When input is unfocused, the cursor SHALL be hidden.

#### Scenario: Cursor shown when input is focused
- **WHEN** the user presses a key or the input panel receives focus
- **THEN** the system calls `setCursorPosition({ x: stringWidth(prompt + text), y: 1 })` to show the cursor at the end of the current input text

#### Scenario: Cursor hidden when input is unfocused
- **WHEN** the user presses Enter or Tab to unfocus the input
- **THEN** the system calls `setCursorPosition(undefined)` to hide the cursor

#### Scenario: Cursor follows input text
- **WHEN** the user types characters into the input field
- **THEN** the cursor position is updated to `stringWidth(prompt + text)` on each character

### Requirement: Cursor Character Configuration
The TUI SHALL source the cursor character from `config.tui.cursorChar` (default `█`), configurable via terminal escape sequences.

#### Scenario: Default cursor character is block
- **WHEN** the TUI initializes without a custom `cursorChar` config
- **THEN** the cursor character defaults to `█` (U+2588 FULL BLOCK)

#### Scenario: Cursor character is configurable
- **WHEN** `config.tui.cursorChar` is set to a different character
- **THEN** the TUI uses the configured character for the cursor display

### Requirement: Cursor Blinking
The TUI SHALL NOT manage cursor blinking — this SHALL be delegated to the terminal emulator.

#### Scenario: Terminal controls cursor blink
- **WHEN** the cursor is visible
- **THEN** the terminal emulator controls the blink rate and pattern, not the TUI
