## ADDED Requirements

### Requirement: TUI State Management via useReducer
The TUI SHALL consolidate all state into a single `useReducer` with a `TUIState` interface and typed action types. All state updates SHALL flow through the reducer, ensuring one render cycle per meaningful state change.

#### Scenario: State consolidation
- **WHEN** the TUI initializes
- **THEN** all state (messages, chatHistory, historyIndex, inputText, inputFocused, contextSize, isCompacting, isStreaming, isAutoContinuing, autoContinueCount, scrollOffset, viewportHeight, toggles) is managed by a single `useReducer`

#### Scenario: Single render per state change
- **WHEN** a message arrives during streaming
- **THEN** `messages`, `statusMessage`, `contextSize`, and `chatHistory` update in a single render cycle via one reducer dispatch

#### Scenario: Typed action types
- **WHEN** any state transition occurs
- **THEN** the action type is one of the defined `TUIAction` union types (ADD_MESSAGE, UPDATE_MESSAGE, CLEAR_MESSAGES, SET_INPUT_TEXT, SUBMIT_INPUT, SET_STATUS, SET_STREAMING, TOGGLE_CONFIG, etc.)

### Requirement: Streaming Logic Extracted to useStreaming Hook
The TUI SHALL extract all streaming logic into a dedicated `useStreaming()` hook that manages the AbortController lifecycle, translates stream events into state transitions, handles the auto-continue circuit breaker, and exposes a clean `streamingState` object to the UI.

#### Scenario: AbortController lifecycle
- **WHEN** a user message is submitted
- **THEN** `useStreaming()` creates an `AbortController` and passes its signal to the dispatch pipeline

#### Scenario: Stream event transformation
- **WHEN** a stream event arrives (text, reasoning, tool_start, tool_end, tool_error, compaction_start, compaction_end, todo_status)
- **THEN** `useStreaming()` transforms the event into the appropriate state update via `handleStreamEvent()`

#### Scenario: Auto-continue circuit breaker
- **WHEN** the agent returns zero text output
- **THEN** `useStreaming()` sends a "Please continue." signal, repeating up to `config.agent.autoContinueLimit` (default 1000) times before triggering a circuit breaker error

#### Scenario: Streaming interrupt
- **WHEN** the user presses Escape during streaming
- **THEN** `useStreaming()` aborts the controller, clears the streaming cursor, and handles cleanup (pops user message, clears partial assistant message, deletes checkpointer thread)

### Requirement: Concern-Based File Structure
The TUI SHALL restructure `src/tui/` into a concern-based hierarchy with directories for `state/`, `hooks/`, `components/`, `panels/`, and `utils/`.

#### Scenario: File organization
- **WHEN** the TUI is restructured
- **THEN** files are organized as: `state/reducer.js`, `state/types.js`, `state/selectors.js`, `hooks/useStreaming.js`, `hooks/useScroll.js`, `hooks/useInput.js`, `hooks/useCommand.js`, `components/ConversationPanel.js`, `components/InputPanel.js`, `components/StatusBar.js`, `components/MessageBubble.js`, `components/Banner.js`, `panels/OnboardingPanel.js`, `utils/commandParser.js`, `utils/contextTokens.js`, `utils/markdownText.js`, `utils/format.js`

#### Scenario: Root component location
- **WHEN** the TUI is loaded
- **THEN** `src/tui/app.js` remains at the root as the root component with providers and reducer, and `src/tui/index.js` remains as the entry point

### Requirement: Panel System Removal
The TUI SHALL remove `panels.js`, `skillsPanel.js`, `memoryPanel.js`, and `settingsPanel.js`. Skills and memory inspection SHALL be provided via commands (`/skills`, `/memory`) that produce output in the conversation stream.

#### Scenario: Panel files removed
- **WHEN** the TUI is restructured
- **THEN** `panels.js`, `skillsPanel.js`, `memoryPanel.js`, and `settingsPanel.js` are deleted from `src/tui/`

#### Scenario: Skills via command
- **WHEN** the user types `/skills`
- **THEN** the TUI displays registered skills as output in the conversation stream

#### Scenario: Memory via command
- **WHEN** the user types `/memory`
- **THEN** the TUI displays memory context as output in the conversation stream

#### Scenario: OnboardingPanel preserved
- **WHEN** the TUI initializes with no user profile
- **THEN** `OnboardingPanel` in `panels/` renders the first-run onboarding flow

### Requirement: Event-Driven Command Registry
The TUI SHALL refactor `commandParser.js` from a switch-driven dispatch table to an event-driven command registry where commands are registered as objects with `validate`, `execute`, and `help` properties.

#### Scenario: Command registration
- **WHEN** a new command is added
- **THEN** it is registered as a `Command` object with `name`, `description`, `usage`, `validate`, and `execute` properties — no switch case editing required

#### Scenario: Command validation
- **WHEN** a command is invoked with arguments
- **THEN** the `validate` function is called first; if it returns a string (error message), the error is displayed and execution is skipped

#### Scenario: Command execution
- **WHEN** a command passes validation
- **THEN** the `execute` function is called with `(args, state, dispatch, helpers)` and can be async

#### Scenario: Unknown commands
- **WHEN** the user types an unrecognized command
- **THEN** the TUI responds: "Unknown command: /<command>. Type /help for available commands."

### Requirement: Runtime Toggle System
The TUI SHALL implement bitchx-inspired `/toggle` commands for runtime configuration overrides. Toggles SHALL be stored in memory only; `config.yaml` `tui` section is the source of truth on restart.

#### Scenario: Toggle command
- **WHEN** the user types `/toggle timestamps`
- **THEN** the timestamps toggle is flipped (on → off, off → on)

#### Scenario: Toggle list
- **WHEN** the user types `/toggle` with no arguments
- **THEN** the TUI displays all toggles and their current states

#### Scenario: Toggle persistence
- **WHEN** the TUI restarts
- **THEN** toggle states revert to `config.yaml` `tui` section defaults

#### Scenario: Toggleable settings
- **WHEN** the TUI initializes
- **THEN** the following toggles are available: `autoScroll` (default: true), `timestamps` (default: true), `commandEcho` (default: true), `cursorBreathe` (default: true), `debugOutput` (default: false)

### Requirement: Status Bar Toggle Indicators
The TUI SHALL display toggle/filter status indicators in the status bar for quick glance visibility of active runtime features.

#### Scenario: Status bar indicators
- **WHEN** the status bar renders
- **THEN** it displays toggle states such as `[ts:1 scroll:1]` alongside existing elements (status indicator, skill count, message count, context size)

### Requirement: Message Display
The TUI SHALL render messages as role-colored bubbles with markdown support, tool call display, and reasoning content.

#### Scenario: Role-based styling
- **WHEN** a message is rendered
- **THEN** user messages are green/right-aligned, system messages are yellow/left-aligned, assistant messages are cyan/left-aligned

#### Scenario: Markdown rendering
- **WHEN** an assistant message contains markdown
- **THEN** it is rendered through `marked` + `marked-terminal` with a module-level parse cache

#### Scenario: Memoization
- **WHEN** a message is unchanged during streaming
- **THEN** `React.memo` with a custom `areEqual` function prevents unnecessary re-renders

### Requirement: Scrolling & Viewport
The TUI SHALL use `ink-scroll-view`'s `ScrollView` for the conversation area with auto-scroll, keyboard scrolling, and terminal resize handling.

#### Scenario: Auto-scroll
- **WHEN** a new message arrives and the user is at the bottom
- **THEN** `scrollToBottom()` is called (deferred via setTimeout 0ms)

#### Scenario: User-initiated scroll
- **WHEN** the user scrolls up
- **THEN** the TUI stays at the user's position (no forced scroll)

#### Scenario: Terminal resize
- **WHEN** the terminal is resized
- **THEN** `remeasure()` is called on the scroll ref to update viewport dimensions

#### Scenario: Keyboard scrolling
- **WHEN** the user presses Up/Down/PageUp/PageDown with input unfocused
- **THEN** the conversation area scrolls accordingly

### Requirement: Command Set
The TUI SHALL support the following commands:

#### Scenario: Core commands
- **WHEN** the user types `/quit`, `/clear`, `/new`, or `/help`
- **THEN** the TUI executes the corresponding action (exit, clear conversation, new session, show help)

#### Scenario: Config command
- **WHEN** the user types `/config set <path> <value>`
- **THEN** the TUI sets the specified config value

#### Scenario: Provider command
- **WHEN** the user types `/provider set <name>`
- **THEN** the TUI switches the AI provider

#### Scenario: Schedule commands
- **WHEN** the user types `/schedule list`, `/schedule pause <name>`, `/schedule resume <name>`, or `/schedule run-now <name>`
- **THEN** the TUI manages scheduled tasks accordingly

#### Scenario: GC command
- **WHEN** the user types `/gc` or `/gc status`
- **THEN** the TUI triggers V8 garbage collection or shows GC status

#### Scenario: Skill execution
- **WHEN** the user types `/skillName [args]` matching a registered skill
- **THEN** the skill body is loaded and streamed to the agent as a prompt

### Requirement: Input Lifecycle
The TUI SHALL manage the input lifecycle with cursor visibility toggling, command history, and input focus state.

#### Scenario: Input focus
- **WHEN** the user presses a key
- **THEN** the cursor appears and input is focused

#### Scenario: Command history
- **WHEN** the user presses Up/Down arrows while at the bottom of the output
- **THEN** the TUI scrolls through command history (not output)

#### Scenario: Cursor fade
- **WHEN** the user is idle at the input for 2 seconds
- **THEN** the cursor fades to dark gray

### Requirement: Edge Cases & Resilience
The TUI SHALL handle terminal resize, streaming overflow, connection loss, model stuck in thinking loop, and output retention gracefully.

#### Scenario: Connection loss
- **WHEN** an error occurs in `dispatchProvider`
- **THEN** a system message is displayed, the streaming message is cleared, and the session is saved

#### Scenario: Model stuck in thinking loop
- **WHEN** the agent returns zero text output for `config.agent.autoContinueLimit` (default 1000) consecutive times
- **THEN** an error message is shown, the counter resets, and the user must rephrase or start a new session
