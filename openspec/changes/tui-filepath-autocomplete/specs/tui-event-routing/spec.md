## MODIFIED Requirements

### Requirement: Escape handles global actions
The TUI SHALL use Escape at the app level to perform global actions (quit or interrupt). However, when the file autocomplete overlay is active, Escape SHALL dismiss the overlay instead of performing the global action.

#### Scenario: Escape from inputBar interrupts streaming
- **WHEN** the inputBar is focused and the user presses Escape during streaming
- **THEN** the streaming response is interrupted

#### Scenario: Escape from message list quits app
- **WHEN** the message list is focused and the user presses Escape
- **THEN** the TUI app quits

#### Scenario: Escape dismisses autocomplete overlay
- **WHEN** the file autocomplete overlay is active and the user presses Escape
- **THEN** the overlay is dismissed and the input panel retains focus without triggering the global action
