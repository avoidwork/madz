## ADDED Requirements

### Requirement: Keyboard scrolling when input is unfocused
The TUI SHALL capture keyboard input via Ink's `useInput` and translate arrow keys and page keys into scroll actions on the `ScrollView` ref when the input is not focused.

#### Scenario: Up arrow scrolls up when input is unfocused
- **WHEN** the input panel is not focused and the user presses the up arrow key
- **THEN** the ScrollView ref calls `scrollBy(-1)` to scroll up one line

#### Scenario: Down arrow scrolls down when input is unfocused
- **WHEN** the input panel is not focused and the user presses the down arrow key
- **THEN** the ScrollView ref calls `scrollBy(1)` to scroll down one line

#### Scenario: Page up scrolls up by viewport height when input is unfocused
- **WHEN** the input panel is not focused and the user presses page-up
- **THEN** the ScrollView ref calls `scrollBy(-N)` where N equals the current viewport height

#### Scenario: Page down scrolls down by viewport height when input is unfocused
- **WHEN** the input panel is not focused and the user presses page-down
- **THEN** the ScrollView ref calls `scrollBy(N)` where N equals the current viewport height

#### Scenario: Up arrow scrolls history when input is focused
- **WHEN** the input panel is focused and the user presses the up arrow key
- **THEN** the system scrolls through command history (not output)

#### Scenario: Down arrow scrolls history forward when input is focused
- **WHEN** the input panel is focused and the user presses the down arrow key
- **THEN** the system scrolls forward through command history
