# tui-esc-interrupt Specification

## Purpose
Define the ESC key behavior for interrupting/skipping operations in the Madz TUI, with exceptions for onboarding and panel contexts.

## Requirements

### Requirement: ESC SHALL interrupt the current operation instead of exiting the application

When the user presses ESC in the main TUI context, the system SHALL interrupt or skip the current operation and return to the main prompt without exiting the application.

#### Scenario: ESC interrupts streaming operation
- **WHEN** the agent is streaming a response and the user presses ESC
- **THEN** the system SHALL abort the current stream
- **THEN** the system SHALL display "Interrupted." status
- **THEN** the system SHALL return to the main prompt

#### Scenario: ESC interrupts non-streaming operation
- **WHEN** the agent is performing a non-streaming operation (file write, search, query) and the user presses ESC
- **THEN** the system SHALL cancel the operation
- **THEN** the system SHALL display "[interrupted]" or "[cancelled]" status
- **THEN** the system SHALL return to the main prompt

#### Scenario: ESC with no active operation
- **WHEN** no operation is active and the user presses ESC
- **THEN** the system SHALL display "[interrupted]" or "[cancelled]" status
- **THEN** the system SHALL return to the main prompt (no change in state)

### Requirement: ESC SHALL preserve onboarding behavior

During the onboarding/profile creation flow, ESC SHALL continue to exit the application as currently implemented.

#### Scenario: ESC during onboarding exits app
- **WHEN** the user is in the onboarding/profile creation flow and presses ESC
- **THEN** the system SHALL exit the application (unchanged behavior)

### Requirement: ESC SHALL preserve panel navigation behavior

In panel views (settings, memory), ESC SHALL continue to exit the panel and return to the main view.

#### Scenario: ESC in settings panel exits panel
- **WHEN** the user is viewing the settings panel and presses ESC
- **THEN** the system SHALL exit the settings panel and return to the main view

#### Scenario: ESC in memory panel exits panel
- **WHEN** the user is viewing the memory panel and presses ESC
- **THEN** the system SHALL exit the memory panel and return to the main view

### Requirement: Visual feedback SHALL be provided on interrupt

When an operation is interrupted, the system SHALL display visual feedback to confirm the interrupt was received.

#### Scenario: Visual feedback on interrupt
- **WHEN** an operation is interrupted (streaming or non-streaming)
- **THEN** the system SHALL display "[interrupted]" or "[cancelled]" in the status area
- **THEN** the feedback SHALL be visible for approximately 2 seconds
- **THEN** the feedback SHALL fade out or be replaced by the next status message

### Requirement: Session state SHALL be preserved on interrupt

Interrupting an operation SHALL NOT clear the conversation history or session state.

#### Scenario: Session preserved after interrupt
- **WHEN** an operation is interrupted
- **THEN** the conversation history SHALL be preserved
- **THEN** the session ID SHALL remain unchanged
- **THEN** only orphaned/intermediate state (e.g., partial tool-call messages) SHALL be cleaned up

### Requirement: Rapid ESC presses SHALL be handled gracefully

Multiple rapid ESC presses SHALL not cause crashes, unexpected behavior, or duplicate interrupts.

#### Scenario: Rapid ESC presses
- **WHEN** the user presses ESC multiple times in rapid succession (within 500ms)
- **THEN** the system SHALL process only the first interrupt
- **THEN** subsequent ESC presses within the debounce window SHALL be ignored
- **THEN** the system SHALL NOT crash or enter an error state