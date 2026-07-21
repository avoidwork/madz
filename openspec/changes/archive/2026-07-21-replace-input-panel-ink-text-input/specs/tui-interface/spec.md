## MODIFIED Requirements

### Requirement: Interactive Chat Mode
The system SHALL provide an interactive conversational mode where users can type messages using an `ink-text-input` component, receive LLM responses, and view conversation history in a scrollable terminal buffer.

#### Scenario: User sends a message and receives a response
- **WHEN** user types a message in the input panel (ink-text-input) and presses Enter
- **THEN** the system displays the user message followed by the LLM response in the conversation panel

#### Scenario: User scrolls through conversation history
- **WHEN** the conversation exceeds the visible terminal height
- **THEN** the user can scroll up to view prior messages using page-up/page-down or arrow keys

### Requirement: Keyboard Navigation
The system SHALL support panel-based keyboard navigation using Tab, Shift+Tab, and arrow keys to switch between the conversation, memory, skills, and settings panels. The input panel SHALL use `ink-text-input` for text entry with built-in cursor navigation, while Tab key handling for focus toggle between input and message list is managed by App's `useInput` hook.

#### Scenario: User navigates between panels
- **WHEN** user presses Tab in the TUI
- **THEN** focus cycles to the next panel in the order: conversation → skills → memory → settings → conversation

#### Scenario: Input panel receives focus via Tab
- **WHEN** user presses Tab while focus is on the message list
- **THEN** the input panel gains focus and the user can begin typing

#### Scenario: Input panel loses focus via Tab
- **WHEN** user presses Tab while the input panel has focus
- **THEN** focus moves to the next panel and the input component loses focus
