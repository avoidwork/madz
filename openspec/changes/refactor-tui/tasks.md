## 1. State Management Foundation

- [ ] 1.1 Create `src/tui/state/types.js` with `TUIState` interface and `TUIAction` union type
- [ ] 1.2 Create `src/tui/state/reducer.js` with `initialState` and all action handlers
- [ ] 1.3 Create `src/tui/state/selectors.js` with derived state selectors (contextSize, statusMessage, scroll indicators)
- [ ] 1.4 Write unit tests for reducer (`tests/unit/tui/reducer.test.js`) covering all action types and edge cases

## 2. Cursor Positioning

- [ ] 2.1 Create cursor visibility management using `useCursor` hook (focused → shown, unfocused → hidden)
- [ ] 2.2 Implement cursor character configuration from `config.tui.cursorChar`
- [ ] 2.3 Wire cursor positioning into `InputPanel` component
- [ ] 2.4 Write unit tests for cursor positioning

## 3. Message Display

- [ ] 3.1 Define `Message` interface in `state/types.js` with all required fields
- [ ] 3.2 Implement role-based styling in `MessageBubble` (user=green, system=yellow, assistant=cyan)
- [ ] 3.3 Add `React.memo` with custom `areEqual` to `MessageBubble`
- [ ] 3.4 Implement markdown rendering through `marked` + `marked-terminal` with parse cache
- [ ] 3.5 Strip streaming cursor character (`█`) before markdown parsing
- [ ] 3.6 Write unit tests for message display (`tests/unit/tui/markdownText.test.js`)

## 4. Streaming Hook Extraction

- [ ] 4.1 Create `src/tui/hooks/useStreaming.js` with AbortController lifecycle management
- [ ] 4.2 Implement stream event transformation logic (`handleStreamEvent` function)
- [ ] 4.3 Implement auto-continue circuit breaker with configurable limit
- [ ] 4.4 Expose `streamingState` object from the hook
- [ ] 4.5 Write unit tests for streaming hook (`tests/unit/tui/useStreaming.test.js`) covering event transformation, auto-continue, and abort handling

## 5. Scroll and Input Hooks

- [ ] 5.1 Create `src/tui/hooks/useScroll.js` with ScrollView ref, resize handling, and keyboard scroll
- [ ] 5.2 Create `src/tui/hooks/useInput.js` with keyboard routing (scroll vs history vs input)
- [ ] 5.3 Write unit tests for scroll and input hooks

## 6. File Structure Reorganization

- [ ] 6.1 Create directory structure: `state/`, `hooks/`, `components/`, `panels/`, `utils/`
- [ ] 6.2 Move `MessageBubble.js` to `components/`
- [ ] 6.3 Move `ConversationPanel.js` to `components/`
- [ ] 6.4 Move `StatusBar.js` to `components/`
- [ ] 6.5 Move `InputPanel.js` to `components/`
- [ ] 6.6 Move `Banner.js` to `components/`
- [ ] 6.7 Move `OnboardingPanel.js` to `panels/`
- [ ] 6.8 Move `commandParser.js` to `utils/`
- [ ] 6.9 Move `contextTokens.js` to `utils/`
- [ ] 6.10 Move `markdownText.js` to `utils/`
- [ ] 6.11 Update all import paths to reflect new structure
- [ ] 6.12 Verify no circular dependencies

## 7. Panel System Removal

- [ ] 7.1 Remove `src/tui/panels.js`
- [ ] 7.2 Remove `src/tui/skillsPanel.js`
- [ ] 7.3 Remove `src/tui/memoryPanel.js`
- [ ] 7.4 Remove `src/tui/settingsPanel.js`
- [ ] 7.5 Add `/skills` command to command registry that displays skills in conversation stream
- [ ] 7.6 Add `/memory` command to command registry that displays memory entries in conversation stream
- [ ] 7.7 Update `app.js` to remove panel-related imports and rendering logic
- [ ] 7.8 Write integration test for `/skills` and `/memory` commands

## 8. Command Registry Redesign

- [ ] 8.1 Create `src/tui/utils/commandParser.js` with `Command` interface and registry pattern
- [ ] 8.2 Implement `validate`, `execute`, and `help` property schema for commands
- [ ] 8.3 Register all existing commands (`/quit`, `/clear`, `/new`, `/help`, `/config`, `/provider`, `/schedule`, `/gc`)
- [ ] 8.4 Implement skill execution fallback for unrecognized skill-name commands
- [ ] 8.5 Implement unknown command error handling
- [ ] 8.6 Write unit tests for command parser (`tests/unit/tui/commandParser.test.js`) covering validation, execution, and unknown commands

## 9. Runtime Toggle System

- [ ] 9.1 Add `toggles` field to `TUIState` interface with all toggleable settings
- [ ] 9.2 Add `TOGGLE_CONFIG` and `SET_CONFIG` actions to reducer
- [ ] 9.3 Implement `/toggle` command handler (toggle single, show all, show states)
- [ ] 9.4 Wire toggle state into message rendering (timestamps, autoScroll, cursorBreathe)
- [ ] 9.5 Add toggle indicators to status bar
- [ ] 9.6 Write unit tests for toggle functionality

## 10. Resilience & Edge Cases

- [ ] 10.1 Implement terminal resize handling (`stdout.on("resize")` → `remeasure()`)
- [ ] 10.2 Implement streaming overflow handling with content hash tracking
- [ ] 10.3 Implement connection loss error handling (system message, clear streaming, save session)
- [ ] 10.4 Implement model stuck-in-thinking-loop detection with circuit breaker
- [ ] 10.5 Write unit tests for resilience handlers

## 11. Session & Persistence Integration

- [ ] 11.1 Wire `sessionState.addExchange()` into message submission flow
- [ ] 11.2 Wire `onSaveSession` callback for session persistence
- [ ] 11.3 Integrate `tiktoken` context token calculation with status bar
- [ ] 11.4 Wire `gcManager.onActivity` for idle GC triggering

## 12. App Component Integration

- [ ] 12.1 Replace `useState` calls in `app.js` with `useReducer` dispatch
- [ ] 12.2 Integrate `useStreaming()` hook into `handleChat()` and `handleCommand()`
- [ ] 12.3 Integrate `useScroll()` hook for scroll management
- [ ] 12.4 Integrate `useInput()` hook for keyboard handling
- [ ] 12.5 Integrate `useCommand()` hook for command parsing
- [ ] 12.6 Remove inline streaming callback setup
- [ ] 12.7 Verify cursor visibility toggling still works with new architecture

## 13. Testing & Verification

- [ ] 13.1 Run full test suite — verify all existing tests pass
- [ ] 13.2 Verify 100% coverage on all new files
- [ ] 13.3 Verify existing file coverage maintained
- [ ] 13.4 Manual smoke test: launch TUI, send message, verify streaming, test toggles, test commands
- [ ] 13.5 Integration test: full flow (user input → streaming → message display → command execution)
