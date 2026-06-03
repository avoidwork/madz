## ADDED Requirements

### Requirement: Cursor-Based Focus Indicator
The `InputPanel` component SHALL hide its cursor when the conversation panel has focus, and show its cursor when the input panel has focus.

#### Scenario: Input panel cursor is visible when input is focused
- **WHEN** focus is on the input panel (`isInputFocused === true`)
- **THEN** the `Blink` component renders with the cursor character visible

#### Scenario: Input panel cursor is hidden when conversation is focused
- **WHEN** focus is on the conversation panel (`isInputFocused === false`)
- **THEN** the `Blink` component renders without a visible cursor character (zero-width space placeholder)

### Requirement: Focus Cycling with Tab
The App component SHALL toggle focus between the input panel and conversation panel when the user presses Tab.

#### Scenario: Pressing Tab cycles focus to conversation
- **WHEN** the user presses Tab while focus is on the input panel
- **THEN** focus switches to the conversation panel (cursor hides in input)

#### Scenario: Pressing Shift+Tab cycles focus back to input
- **WHEN** the user presses Shift+Tab while focus is on the conversation panel
- **THEN** focus switches back to the input panel (cursor reappears in input)

### Requirement: Focus-Routed Input Handling
The App component SHALL route keyboard input to the correct panel based on the current focus state.

#### Scenario: Input keys only work when input is focused
- **WHEN** focus is on the input panel and user types characters, presses Backspace, or presses Enter
- **THEN** the input is captured by the input handler (text accumulation, send, history navigation)

#### Scenario: Scroll keys only work when conversation is focused
- **WHEN** focus is on the conversation panel and user presses Up Arrow, Down Arrow, Page Up, or Page Down
- **THEN** the conversation panel scrolls accordingly

#### Scenario: Keys do not affect unfocused panel
- **WHEN** focus is on the conversation panel and user types a character
- **THEN** the character is not added to the input text

#### Scenario: Up Arrow scrolls when conversation is focused, does not use history when input is focused
- **WHEN** focus is on the conversation panel and user presses Up Arrow
- **THEN** the conversation panel scrolls up (not chat history)

### Requirement: Input Panel Default Focus
On initial App mount and on new session start, the input panel SHALL have focus.

#### Scenario: Default focus on App mount
- **WHEN** the App component renders for the first time
- **THEN** the input panel has active focus (`isInputFocused === true`)

#### Scenario: Focus returns to input on Enter
- **WHEN** the user presses Enter to send a message
- **THEN** focus returns to the input panel after the message is dispatched

## MODIFIED Requirements

### Requirement: Keyboard Navigation (from tui-interface)
The system SHALL support panel-based keyboard navigation using Tab to switch between the input panel and conversation panel.

#### Scenario: User navigates between input and conversation with Tab
- **WHEN** user presses Tab in the TUI after the banner is dismissed
- **THEN** focus cycles from input to conversation, hiding the cursor in the input panel

#### Scenario: User returns to input with Shift+Tab
- **WHEN** user presses Shift+Tab while focused on the conversation
- **THEN** focus cycles from conversation to input, showing the cursor in the input panel
