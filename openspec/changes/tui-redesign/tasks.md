## 1. State Management Foundation

- [ ] 1.1 Create `src/tui/state/types.js` with TUIState interface, TUIAction discriminated union, and initialState
- [ ] 1.2 Create `src/tui/state/reducer.js` with all action handlers (ADD_MESSAGE, UPDATE_MESSAGE, CLEAR_MESSAGES, ADD_HISTORY, SET_HISTORY_INDEX, SET_INPUT_TEXT, SUBMIT_INPUT, SET_INPUT_FOCUSED, SET_STATUS, SET_CONTEXT_SIZE, SET_COMPACTING, SET_STREAMING, SET_AUTO_CONTINUING, INCREMENT_AUTO_CONTINUE, RESET_AUTO_CONTINUE, SET_SCROLL_OFFSET, SET_VIEWPORT_HEIGHT, TOGGLE_CONFIG, SET_CONFIG)
- [ ] 1.3 Create `src/tui/state/selectors.js` with derived state functions (contextSize, statusMessage, toggle indicators)

## 2. Streaming Hook

- [ ] 2.1 Create `src/tui/hooks/useStreaming.js` with AbortController lifecycle management
- [ ] 2.2 Implement stream event transformation for all event types (text, reasoning, tool_start, tool_end, tool_error, compaction_start, compaction_end, todo_status)
- [ ] 2.3 Implement auto-continue circuit breaker with configurable limit
- [ ] 2.4 Expose streamingState object with isStreaming, isAutoContinuing, autoContinueCount, and AbortSignal

## 3. Scroll and Input Hooks

- [ ] 3.1 Create `src/tui/hooks/useScroll.js` with ScrollView ref management, resize handling, and keyboard scroll actions
- [ ] 3.2 Create `src/tui/hooks/useInput.js` with keyboard routing (scroll vs history vs input focus toggle)
- [ ] 3.3 Create `src/tui/hooks/useCommand.js` with command parsing and dispatch to registry

## 4. Command Registry

- [ ] 4.1 Create `src/tui/utils/commandParser.js` with event-driven command registry pattern
- [ ] 4.2 Register all commands: /quit, /clear, /new, /help, /config set, /provider set, /schedule list/pause/resume/run-now, /gc, /gc status
- [ ] 4.3 Implement skill execution fallback for unrecognized /command patterns matching skill names
- [ ] 4.4 Implement unknown command response

## 5. Runtime Toggles

- [ ] 5.1 Create `src/tui/utils/format.js` with toggle logic and format specifiers
- [ ] 5.2 Register /toggle command (no args shows all, with arg toggles)
- [ ] 5.3 Implement all five toggles: autoScroll, timestamps, commandEcho, cursorBreathe, debugOutput
- [ ] 5.4 Add toggle indicators to StatusBar component

## 6. Component Refactoring

- [ ] 6.1 Rewrite `src/tui/app.js` to use useReducer instead of eight useState calls
- [ ] 6.2 Integrate useStreaming hook into app.js
- [ ] 6.3 Integrate useScroll and useInput hooks into app.js
- [ ] 6.4 Integrate useCommand hook into app.js
- [ ] 6.5 Update ConversationPanel to use new scroll hook
- [ ] 6.6 Update StatusBar to show toggle indicators

## 7. Panel System Removal

- [ ] 7.1 Remove `src/tui/panels.js`
- [ ] 7.2 Remove `src/tui/skillsPanel.js`
- [ ] 7.3 Remove `src/tui/memoryPanel.js`
- [ ] 7.4 Remove `src/tui/settingsPanel.js`
- [ ] 7.5 Remove panel navigation from app.js (Tab/Shift+Tab)
- [ ] 7.6 Add /skills and /memory commands that output to conversation stream

## 8. File Structure Reorganization

- [ ] 8.1 Create directory structure: state/, hooks/, components/, utils/
- [ ] 8.2 Move MessageBubble to components/
- [ ] 8.3 Move ConversationPanel to components/
- [ ] 8.4 Move InputPanel to components/
- [ ] 8.5 Move StatusBar to components/
- [ ] 8.6 Move Banner to components/
- [ ] 8.7 Move OnboardingPanel to panels/
- [ ] 8.8 Move markdownText.js to utils/
- [ ] 8.9 Move contextTokens.js to utils/

## 9. Entry Point Updates

- [ ] 9.1 Update `src/tui/index.js` to reflect new file structure and imports
- [ ] 9.2 Update `src/tui/app.js` provider wiring for new hook-based architecture

## 10. Testing

- [ ] 10.1 Create `tests/unit/tui/reducer.test.js` covering all action types and edge cases
- [ ] 10.2 Create `tests/unit/tui/commandParser.test.js` covering command validation, execution, and unknown commands
- [ ] 10.3 Create `tests/unit/tui/contextTokens.test.js` covering tiktoken calculation and character-count fallback
- [ ] 10.4 Create `tests/unit/tui/markdownText.test.js` covering markdown rendering, streaming cursor stripping, cache behavior
- [ ] 10.5 Create `tests/unit/tui/useStreaming.test.js` covering event transformation, auto-continue circuit breaker, abort handling
- [ ] 10.6 Create `tests/integration/tui/full-flow.test.js` covering user input → streaming → message display → command execution
