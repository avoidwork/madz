## ADDED Requirements

### Requirement: Centralized TUI State with useReducer
The TUI SHALL use a single `useReducer` hook with a `TUIState` interface to manage all application state, replacing the current eight independent `useState` calls.

#### Scenario: Single reducer manages all state
- **WHEN** the TUI app initializes
- **THEN** a single `useReducer` call manages `messages`, `chatHistory`, `historyIndex`, `inputText`, `inputFocused`, `statusMessage`, `contextSize`, `isCompacting`, `isStreaming`, `isAutoContinuing`, `autoContinueCount`, `scrollOffset`, `viewportHeight`, and `toggles`

#### Scenario: State updates are atomic
- **WHEN** a message arrives during streaming
- **THEN** `messages`, `statusMessage`, `contextSize`, and `chatHistory` are updated in a single reducer dispatch and trigger one render cycle

#### Scenario: Initial state is well-defined
- **WHEN** the TUI initializes
- **THEN** `TUIState` defaults are: `messages: []`, `chatHistory: []`, `historyIndex: -1`, `inputText: ''`, `inputFocused: true`, `statusMessage: 'Ready'`, `contextSize: 0`, `isCompacting: false`, `isStreaming: false`, `isAutoContinuing: false`, `autoContinueCount: 0`, `scrollOffset: 0`, `viewportHeight: 0`, `toggles: { autoScroll: true, timestamps: true, commandEcho: true, cursorBreathe: true, debugOutput: false }`

### Requirement: Typed Action Types
The TUI SHALL define a discriminated union of action types (`TUIAction`) covering all state mutations: `ADD_MESSAGE`, `UPDATE_MESSAGE`, `CLEAR_MESSAGES`, `ADD_HISTORY`, `SET_HISTORY_INDEX`, `SET_INPUT_TEXT`, `SUBMIT_INPUT`, `SET_INPUT_FOCUSED`, `SET_STATUS`, `SET_CONTEXT_SIZE`, `SET_COMPACTING`, `SET_STREAMING`, `SET_AUTO_CONTINUING`, `INCREMENT_AUTO_CONTINUE`, `RESET_AUTO_CONTINUE`, `SET_SCROLL_OFFSET`, `SET_VIEWPORT_HEIGHT`, `TOGGLE_CONFIG`, `SET_CONFIG`.

#### Scenario: All action types are type-safe
- **WHEN** the reducer processes an action
- **THEN** TypeScript enforces that each action type has the correct payload shape

#### Scenario: Unknown action types are handled gracefully
- **WHEN** an unrecognized action type is dispatched
- **THEN** the reducer returns the current state unchanged

### Requirement: Derived State via Selectors
The TUI SHALL use selector functions in `state/selectors.js` to compute derived state (`contextSize`, `statusMessage`, toggle indicators) rather than storing them as separate state values.

#### Scenario: Status message is derived from state
- **WHEN** the status bar renders
- **THEN** it uses a selector to compute the status message from `isStreaming`, `isCompacting`, and `statusMessage` fields

#### Scenario: Context size is computed from messages
- **WHEN** the context size is needed
- **THEN** a selector computes it from the `messages` array using tiktoken (with character-count fallback)
