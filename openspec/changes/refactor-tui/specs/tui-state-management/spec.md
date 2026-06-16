## ADDED Requirements

### Requirement: TUI state is managed by a single useReducer
The TUI SHALL consolidate all state into a single `useReducer` with a `TUIState` interface, replacing the current eight independent `useState` calls. The reducer SHALL handle all state transitions through typed actions.

#### Scenario: State initialization
- **WHEN** the TUI mounts
- **THEN** `useReducer` initializes with `initialState` containing all fields: `messages`, `chatHistory`, `historyIndex`, `inputText`, `inputFocused`, `statusMessage`, `contextSize`, `isCompacting`, `isStreaming`, `isAutoContinuing`, `autoContinueCount`, `scrollOffset`, `viewportHeight`, and `toggles`

#### Scenario: Message addition via reducer
- **WHEN** a message arrives via streaming callback
- **THEN** the reducer processes an `ADD_MESSAGE` or `UPDATE_MESSAGE` action and updates the messages array in a single state transition

#### Scenario: Input state updates
- **WHEN** the user types in the input field
- **THEN** the reducer processes a `SET_INPUT_TEXT` action and updates `inputText` without affecting other state fields

#### Scenario: Concurrent state updates
- **WHEN** a message arrives and context size changes simultaneously
- **THEN** both updates are batched into a single reducer call, producing one render cycle

### Requirement: TUIState interface defines all state shape
The `TUIState` interface SHALL define all state fields with correct types, and `initialState` SHALL provide default values matching the blueprint.

#### Scenario: TUIState includes all current state fields
- **WHEN** the types file is inspected
- **THEN** `TUIState` includes: `messages: Message[]`, `chatHistory: string[]`, `historyIndex: number`, `inputText: string`, `inputFocused: boolean`, `statusMessage: string`, `contextSize: number`, `isCompacting: boolean`, `isStreaming: boolean`, `isAutoContinuing: boolean`, `autoContinueCount: number`, `scrollOffset: number`, `viewportHeight: number`, `toggles: ToggleConfig`

#### Scenario: Toggle config has all five toggles
- **WHEN** the `Toggles` type is inspected
- **THEN** it includes: `autoScroll: boolean`, `timestamps: boolean`, `commandEcho: boolean`, `cursorBreathe: boolean`, `debugOutput: boolean`

### Requirement: Typed action types cover all state transitions
All state transitions SHALL go through typed actions defined in `TUIAction`, with no direct state mutations.

#### Scenario: Message actions
- **WHEN** messages need to be added, updated, or cleared
- **THEN** the reducer handles `ADD_MESSAGE`, `UPDATE_MESSAGE`, and `CLEAR_MESSAGES` actions

#### Scenario: Input actions
- **WHEN** the user types, submits, or changes focus
- **THEN** the reducer handles `SET_INPUT_TEXT`, `SUBMIT_INPUT`, and `SET_INPUT_FOCUSED` actions

#### Scenario: Status actions
- **WHEN** status changes (compacting, streaming, context size)
- **THEN** the reducer handles `SET_STATUS`, `SET_CONTEXT_SIZE`, `SET_COMPACTING`, `SET_STREAMING`, `SET_AUTO_CONTINUING`, `INCREMENT_AUTO_CONTINUE`, and `RESET_AUTO_CONTINUE` actions

#### Scenario: Scroll actions
- **WHEN** scroll position or viewport changes
- **THEN** the reducer handles `SET_SCROLL_OFFSET` and `SET_VIEWPORT_HEIGHT` actions

#### Scenario: Config actions
- **WHEN** runtime toggles change
- **THEN** the reducer handles `TOGGLE_CONFIG` and `SET_CONFIG` actions

### Requirement: Selectors derive computed state
Derived state values SHALL be computed via selector functions, not stored redundantly in state.

#### Scenario: Status message derivation
- **WHEN** `isCompacting` is true
- **THEN** the status selector returns "Compacting context..."

#### Scenario: Context size formatting
- **WHEN** context size is 1200 tokens
- **THEN** the context size selector returns "1.2k" (human-readable format)
