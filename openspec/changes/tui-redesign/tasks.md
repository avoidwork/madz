## 1. Setup — Directory Structure

- [ ] 1.1 Create `src/tui/state/`, `src/tui/hooks/`, `src/tui/components/`, `src/tui/panels/`, `src/tui/utils/` directories
- [ ] 1.2 Move existing files to new directories: `commandParser.js` → `utils/`, `contextTokens.js` → `utils/`, `markdownText.js` → `utils/`, `OnboardingPanel.js` → `panels/`

## 2. State Types & Reducer

- [ ] 2.1 Create `src/tui/state/types.js` with `TUIState` interface, `TUIAction` union type, and `Message` interface
- [ ] 2.2 Create `src/tui/state/reducer.js` with `initialState` and `tuiReducer` handling all action types
- [ ] 2.3 Create `src/tui/state/selectors.js` with derived state functions (`contextSize`, `statusMessage`, etc.)

## 3. Streaming Hook

- [ ] 3.1 Create `src/tui/hooks/useStreaming.js` with AbortController lifecycle management
- [ ] 3.2 Implement `handleStreamEvent()` for all stream event types (text, reasoning, tool_start, tool_end, tool_error, compaction_start, compaction_end, todo_status)
- [ ] 3.3 Implement auto-continue circuit breaker logic with configurable limit
- [ ] 3.4 Implement interrupt handling (abort, clear cursor, cleanup)
- [ ] 3.5 Export `useStreaming()` hook that returns `{ streamingState, handleSubmit, handleInterrupt }`

## 4. Scroll Hook

- [ ] 4.1 Create `src/tui/hooks/useScroll.js` with ScrollView ref, resize handling, and keyboard scroll logic

## 5. Input Hook

- [ ] 5.1 Create `src/tui/hooks/useInput.js` with keyboard routing (scroll vs history vs input)

## 6. Command Hook

- [ ] 6.1 Create `src/tui/hooks/useCommand.js` with command parsing and dispatch

## 7. Command Registry Refactor

- [ ] 7.1 Refactor `src/tui/utils/commandParser.js` to event-driven command registry with `Command` interface (`name`, `description`, `usage`, `validate`, `execute`)
- [ ] 7.2 Register all existing commands as registry entries: `/quit`, `/clear`, `/new`, `/help`, `/config`, `/provider`, `/schedule`, `/gc`
- [ ] 7.3 Implement unknown command handler with "Unknown command" message
- [ ] 7.4 Implement skill execution fallback for unrecognized `/command` patterns matching registered skill names

## 8. Component Extraction

- [ ] 8.1 Create `src/tui/components/ConversationPanel.js` extracted from `app.js` (ScrollView + MessageBubble[])
- [ ] 8.2 Create `src/tui/components/InputPanel.js` extracted from `app.js` (text input with cursor)
- [ ] 8.3 Create `src/tui/components/StatusBar.js` extracted from `app.js` (status indicator, metrics, toggle indicators)
- [ ] 8.4 Create `src/tui/components/MessageBubble.js` extracted from `app.js` (role-colored, markdown-rendered, React.memo)
- [ ] 8.5 Create `src/tui/components/Banner.js` extracted from `app.js` (ASCII art banner, dismiss on key press)

## 9. Runtime Toggle System

- [ ] 9.1 Add `/toggle` command to command registry for runtime config overrides
- [ ] 9.2 Implement toggle flip logic (`/toggle timestamps` flips on/off)
- [ ] 9.3 Implement toggle list display (`/toggle` with no args shows all toggles and states)
- [ ] 9.4 Wire toggles into `TUIState.toggles` and connect to component rendering (timestamps, autoScroll, commandEcho, cursorBreathe, debugOutput)

## 10. Panel Removal

- [ ] 10.1 Delete `src/tui/panels.js`
- [ ] 10.2 Delete `src/tui/skillsPanel.js`
- [ ] 10.3 Delete `src/tui/memoryPanel.js`
- [ ] 10.4 Delete `src/tui/settingsPanel.js`
- [ ] 10.5 Add `/skills` command that displays registered skills in the conversation stream
- [ ] 10.6 Add `/memory` command that displays memory context in the conversation stream

## 11. Status Bar Enhancement

- [ ] 11.1 Add toggle/filter indicators to `StatusBar.js` (e.g., `[ts:1 scroll:1]`)
- [ ] 11.2 Wire toggle state changes to status bar re-render

## 12. Root App Integration

- [ ] 12.1 Refactor `src/tui/app.js` to use `useReducer` instead of `useState`
- [ ] 12.2 Wire `useStreaming()` hook into `app.js` for chat and command submission
- [ ] 12.3 Wire `useScroll()`, `useInput()`, `useCommand()` hooks into `app.js`
- [ ] 12.4 Replace inline component definitions with imports from `components/` directory
- [ ] 12.5 Ensure cursor visibility toggling works with new architecture

## 13. Format Utility

- [ ] 13.1 Create `src/tui/utils/format.js` with format specifier support (`%T`, `%t`, `%B`, `%n`, `%I`, `%R`, `%C`, `%M`)
- [ ] 13.2 Implement `/format` command for runtime format customization (YAGNI — implement only if clear need demonstrated; stub for now)

## 14. Testing

- [ ] 14.1 Write unit tests for `reducer.test.js` — all action types, edge cases (empty state, concurrent updates)
- [ ] 14.2 Write unit tests for `commandParser.test.js` — command validation, execution, unknown commands
- [ ] 14.3 Write unit tests for `contextTokens.test.js` — tiktoken calculation, character-count fallback
- [ ] 14.4 Write unit tests for `markdownText.test.js` — markdown rendering, streaming cursor stripping, cache behavior
- [ ] 14.5 Write unit tests for `useStreaming.test.js` — event transformation, auto-continue circuit breaker, abort handling
- [ ] 14.6 Write integration test `full-flow.test.js` — user input → streaming → message display → command execution
- [ ] 14.7 Run full test suite and verify all 1129+ tests pass

## 15. Cleanup & Verification

- [ ] 15.1 Verify no lint errors in new files
- [ ] 15.2 Verify all imports resolve correctly in new directory structure
- [ ] 15.3 Verify TUI launches and functions correctly with new architecture
- [ ] 15.4 Verify streaming, interrupt, scroll, and command functionality all work
- [ ] 15.5 Verify panel files are removed and `/skills`/`/memory` commands work as replacements
