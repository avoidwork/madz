## MODIFIED Requirements

### Requirement: Keyboard Navigation
The system SHALL support panel-based keyboard navigation using Tab, Shift+Tab, and arrow keys to switch between the conversation, memory, skills, and settings panels. The input panel SHALL use `ink-text-input` for text entry with built-in cursor navigation, while Tab key handling for focus toggle between input and message list is managed by App's `useInput` hook. When the file autocomplete overlay is active, arrow keys navigate the file list instead of the message list, Enter selects the file path, and Escape dismisses the overlay.

#### Scenario: User navigates between panels
- **WHEN** user presses Tab in the TUI
- **THEN** focus cycles to the next panel in the order: conversation → skills → memory → settings → conversation

#### Scenario: Input panel receives focus via Tab
- **WHEN** user presses Tab while focus is on the message list
- **THEN** the input panel gains focus and the user can begin typing

#### Scenario: Input panel loses focus via Tab
- **WHEN** user presses Tab while the input panel has focus
- **THEN** focus moves to the next panel and the input component loses focus

#### Scenario: Autocomplete overlay intercepts arrow keys
- **WHEN** the file autocomplete overlay is active and the user presses up or down arrow
- **THEN** the selection moves within the file list instead of scrolling the message list

#### Scenario: Autocomplete overlay intercepts Enter
- **WHEN** the file autocomplete overlay is active and the user presses Enter
- **THEN** the selected file path is inserted into the input text and the overlay is dismissed

#### Scenario: Autocomplete overlay intercepts Escape
- **WHEN** the file autocomplete overlay is active and the user presses Escape
- **THEN** the overlay is dismissed and the input panel retains focus
