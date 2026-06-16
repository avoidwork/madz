## ADDED Requirements

### Requirement: Consolidated TUI State Management
The system SHALL manage all TUI state through a single `useReducer` with a `TUIState` interface and typed actions, replacing the previous eight independent `useState` calls.

#### Scenario: State update triggers single render
- **WHEN** a message arrives and multiple state fields need updating (messages, statusMessage, contextSize)
- **THEN** the reducer processes all updates in a single state transition, triggering one render cycle

#### Scenario: Reducer handles all action types
- **WHEN** any TUI action is dispatched (ADD_MESSAGE, SET_INPUT_TEXT, SET_STREAMING, etc.)
- **THEN** the reducer correctly updates the state tree and returns a new state object

#### Scenario: Empty state is handled gracefully
- **WHEN** an action is dispatched with no prior state
- **THEN** the reducer returns the initial state without errors

### Requirement: TUIState Interface
The system SHALL define a `TUIState` interface that encompasses all TUI state fields: messages, chatHistory, historyIndex, inputText, inputFocused, statusMessage, contextSize, isCompacting, isStreaming, isAutoContinuing, autoContinueCount, scrollOffset, viewportHeight, and toggles.

#### Scenario: Initial state is well-defined
- **WHEN** the TUI initializes
- **THEN** the initialState object provides default values for all TUIState fields

#### Scenario: Toggles are part of state
- **WHEN** the TUI initializes
- **THEN** the toggles object contains autoScroll, timestamps, commandEcho, cursorBreathe, and debugOutput with their default values

### Requirement: Derived State Selectors
The system SHALL provide selector functions in `state/selectors.js` for computing derived state including contextSize display, statusMessage, and toggle indicator strings.

#### Scenario: Context size is human-readable
- **WHEN** the contextSize selector is called with 1200 tokens
- **THEN** it returns "1.2k" as a human-readable string

#### Scenario: Status message reflects current state
- **WHEN** the status selector is called with isStreaming=true and isCompacting=false
- **THEN** it returns "Streaming..." as the status message
