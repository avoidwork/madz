## ADDED Requirements

### Requirement: Key events route to focused panel
The TUI SHALL route key events to the currently focused panel, allowing that panel to handle its own keyboard interactions.

#### Scenario: InputBar focused — keys pass through to message list
- **WHEN** the inputBar is focused and the user presses a key (e.g., up arrow, down arrow)
- **THEN** the key event is NOT captured by the app-level `useInput()` handler and bubbles to the message list component

#### Scenario: Message list focused — message list handles navigation
- **WHEN** the message list is focused and the user presses up arrow, down arrow, page up, or page down
- **THEN** the message list component receives and processes the key event for scrolling

#### Scenario: Global keys always handled at app level
- **WHEN** the user presses Tab or Escape regardless of which panel is focused
- **THEN** the app-level `useInput()` handler intercepts and processes the key event

### Requirement: Tab toggles focus between panels
The TUI SHALL use Tab to toggle focus between the inputBar and the message list.

#### Scenario: Tab from inputBar moves focus to message list
- **WHEN** the inputBar is focused and the user presses Tab
- **THEN** focus moves to the message list component

#### Scenario: Tab from message list moves focus to inputBar
- **WHEN** the message list is focused and the user presses Tab
- **THEN** focus moves to the inputBar component

### Requirement: Escape handles global actions
The TUI SHALL use Escape at the app level to perform global actions (quit or interrupt).

#### Scenario: Escape from inputBar interrupts streaming
- **WHEN** the inputBar is focused and the user presses Escape during streaming
- **THEN** the streaming response is interrupted

#### Scenario: Escape from message list quits app
- **WHEN** the message list is focused and the user presses Escape
- **THEN** the TUI app quits
