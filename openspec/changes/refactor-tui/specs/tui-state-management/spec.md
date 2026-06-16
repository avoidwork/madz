## ADDED Requirements

### Requirement: Consolidated State Management
The TUI SHALL use a single `useReducer` with a `TUIState` interface instead of eight independent `useState` calls. All state transitions SHALL flow through typed actions defined in `state/types.js`.

#### Scenario: Single reducer handles all state updates
- **WHEN** a message arrives during streaming
- **THEN** the reducer updates `messages`, `statusMessage`, `contextSize`, and `chatHistory` in a single render cycle

#### Scenario: Action types are strictly typed
- **WHEN** any state transition occurs
- **THEN** the action matches one of the defined `TUIAction` union types

#### Scenario: Reducer handles empty state gracefully
- **WHEN** an action is dispatched on empty state
- **THEN** the reducer returns the initial state without error

### Requirement: State Selectors
The TUI SHALL provide derived state selectors in `state/selectors.js` for computed values such as `contextSize`, `statusMessage`, and scroll indicators.

#### Scenario: Context size selector computes token count
- **WHEN** the conversation changes
- **THEN** the `contextSize` selector returns the tiktoken-calculated token count as a human-readable string

#### Scenario: Status message selector derives from state
- **WHEN** streaming state changes
- **THEN** the `statusMessage` selector returns "Streaming..." when `isStreaming` is true, "Ready" otherwise

### Requirement: Initial State Definition
The TUI SHALL define a complete `initialState` object in `state/reducer.js` containing all state fields with sensible defaults.

#### Scenario: Initial state has all required fields
- **WHEN** the reducer initializes
- **THEN** the state contains `messages`, `chatHistory`, `historyIndex`, `inputText`, `inputFocused`, `statusMessage`, `contextSize`, `isCompacting`, `isStreaming`, `isAutoContinuing`, `autoContinueCount`, `scrollOffset`, `viewportHeight`, and `toggles`
