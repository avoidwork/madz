## 1. Setup — Types and State Interface

- [ ] 1.1 Create `src/tui/state/types.js` with `TUIState` interface, `TUIAction` type union, `Message` interface, and `ToggleConfig` type
- [ ] 1.2 Define `initialState` object in `types.js` with all fields and correct defaults
- [ ] 1.3 Create `src/tui/state/selectors.js` with `getStatusMessage`, `formatContextSize`, and derived state selectors

## 2. Reducer Implementation

- [ ] 2.1 Create `src/tui/state/reducer.js` with `tuiReducer` handling all action types
- [ ] 2.2 Implement message actions: `ADD_MESSAGE`, `UPDATE_MESSAGE`, `CLEAR_MESSAGES`
- [ ] 2.3 Implement input actions: `SET_INPUT_TEXT`, `SUBMIT_INPUT`, `SET_INPUT_FOCUSED`
- [ ] 2.4 Implement history actions: `ADD_HISTORY`, `SET_HISTORY_INDEX`
- [ ] 2.5 Implement status actions: `SET_STATUS`, `SET_CONTEXT_SIZE`, `SET_COMPACTING`
- [ ] 2.6 Implement streaming actions: `SET_STREAMING`, `SET_AUTO_CONTINUING`, `INCREMENT_AUTO_CONTINUE`, `RESET_AUTO_CONTINUE`
- [ ] 2.7 Implement scroll actions: `SET_SCROLL_OFFSET`, `SET_VIEWPORT_HEIGHT`
- [ ] 2.8 Implement config actions: `TOGGLE_CONFIG`, `SET_CONFIG`
- [ ] 2.9 Write unit tests for reducer in `tests/unit/tui/reducer.test.js`

## 3. Streaming Hook

- [ ] 3.1 Create `src/tui/hooks/useStreaming.js` with `useStreaming` hook
- [ ] 3.2 Implement AbortController lifecycle: create on start, abort on interrupt
- [ ] 3.3 Implement stream event transformation: `text`, `reasoning`, `tool_start`, `tool_end`, `tool_error`, `compaction_start`, `compaction_end`, `todo_status`
- [ ] 3.4 Implement auto-continue circuit breaker with configurable limit
- [ ] 3.5 Expose `streamingState` object and `abort()` method from hook
- [ ] 3.6 Write unit tests for streaming hook in `tests/unit/tui/useStreaming.test.js`

## 4. Scroll and Input Hooks

- [ ] 4.1 Create `src/tui/hooks/useScroll.js` with ScrollView ref, resize handling, keyboard scroll
- [ ] 4.2 Create `src/tui/hooks/useInput.js` with keyboard routing (scroll vs history vs input)
- [ ] 4.3 Wire `useInput` to handle arrow keys, PageUp/PageDown, Tab, Escape, Enter

## 5. Command Registry

- [ ] 5.1 Create `src/tui/utils/commandParser.js` with event-driven command registry
- [ ] 5.2 Define `Command` interface with `name`, `description`, `usage`, `validate`, `execute`
- [ ] 5.3 Define `CommandHelpers` interface with `dispatchProvider`, `sessionState`, `config`, `scrollRef`
- [ ] 5.4 Register all existing commands: `/quit`, `/clear`, `/new`, `/help`, `/config`, `/provider`, `/schedule`, `/gc`
- [ ] 5.5 Implement unknown command handling with helpful error message
- [ ] 5.6 Implement `/help` command with grouped command display
- [ ] 5.7 Write unit tests for command parser in `tests/unit/tui/commandParser.test.js`

## 6. Runtime Toggles

- [ ] 6.1 Create `src/tui/utils/format.js` with toggle logic and format specifier utilities
- [ ] 6.2 Implement `/toggle` command: toggle on/off with no args, show all states with no params
- [ ] 6.3 Implement toggle state in reducer (already done in step 2)
- [ ] 6.4 Wire toggle state to streaming hook (autoScroll affects scroll behavior)
- [ ] 6.5 Wire toggle state to message rendering (timestamps, commandEcho, debugOutput)
- [ ] 6.6 Wire toggle state to cursor behavior (cursorBreathe)

## 7. Status Bar Toggle Indicators

- [ ] 7.1 Update `StatusBar` component to display toggle indicators `[ts:1 scroll:1]`
- [ ] 7.2 Indicators update reactively when toggles change
- [ ] 7.3 `1` = enabled, `0` = disabled

## 8. File Structure Reorganization

- [ ] 8.1 Create directory structure: `state/`, `hooks/`, `components/`, `utils/`, `panels/`
- [ ] 8.2 Move `MessageBubble.js` → `components/MessageBubble.js`
- [ ] 8.3 Move `ConversationPanel.js` → `components/ConversationPanel.js`
- [ ] 8.4 Move `InputPanel.js` → `components/InputPanel.js`
- [ ] 8.5 Move `StatusBar.js` → `components/StatusBar.js`
- [ ] 8.6 Move `Banner.js` → `components/Banner.js`
- [ ] 8.7 Move `OnboardingPanel.js` → `panels/OnboardingPanel.js`
- [ ] 8.8 Move `contextTokens.js` → `utils/contextTokens.js`
- [ ] 8.9 Move `markdownText.js` → `utils/markdownText.js`
- [ ] 8.10 Update all import paths throughout the TUI to reflect new structure

## 9. Panel Removal

- [ ] 9.1 Delete `src/tui/panels.js`
- [ ] 9.2 Delete `src/tui/skillsPanel.js`
- [ ] 9.3 Delete `src/tui/memoryPanel.js`
- [ ] 9.4 Delete `src/tui/settingsPanel.js`
- [ ] 9.5 Remove all panel imports from `app.js`
- [ ] 9.6 Add `/skills` command that displays registered skills in conversation stream
- [ ] 9.7 Add `/memory` command that displays memory context in conversation stream
- [ ] 9.8 Add `/config` command that displays current config in conversation stream

## 10. App Integration

- [ ] 10.1 Replace `useState` calls in `app.js` with `useReducer`
- [ ] 10.2 Integrate `useStreaming` hook into `app.js`
- [ ] 10.3 Integrate `useScroll` hook into `app.js`
- [ ] 10.4 Integrate `useInput` hook into `app.js`
- [ ] 10.5 Integrate `useCommand` hook into `app.js`
- [ ] 10.6 Wire command registry to input submission
- [ ] 10.7 Wire toggle state to all dependent components
- [ ] 10.8 Update component imports to use new file structure paths

## 11. Testing

- [ ] 11.1 Write `tests/unit/tui/reducer.test.js` — all action types, edge cases
- [ ] 11.2 Write `tests/unit/tui/commandParser.test.js` — command validation, execution, unknown commands
- [ ] 11.3 Write `tests/unit/tui/useStreaming.test.js` — event transformation, auto-continue, abort
- [ ] 11.4 Write `tests/unit/tui/contextTokens.test.js` — tiktoken calculation, fallback
- [ ] 11.5 Write `tests/unit/tui/markdownText.test.js` — markdown rendering, cursor stripping, cache
- [ ] 11.6 Write `tests/integration/tui/full-flow.test.js` — user input → streaming → display → commands
- [ ] 11.7 Verify all existing TUI tests still pass
- [ ] 11.8 Achieve 100% coverage on all new files
