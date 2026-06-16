## 1. Setup — Directory Structure and Type Definitions

- [ ] 1.1 Create new directory structure: `src/tui/state/`, `src/tui/hooks/`, `src/tui/components/`, `src/tui/utils/`
- [ ] 1.2 Create `src/tui/state/types.js` with TUIState interface, TUIAction type, and initialState
- [ ] 1.3 Create `src/tui/state/reducer.js` with useReducer implementation and all action handlers
- [ ] 1.4 Create `src/tui/state/selectors.js` with derived state functions (contextSize display, statusMessage, toggle indicators)

## 2. Streaming Hook Extraction

- [ ] 2.1 Create `src/tui/hooks/useStreaming.js` with AbortController lifecycle management
- [ ] 2.2 Implement stream event transformation (text, reasoning, tool_start, tool_end, tool_error, compaction_start, compaction_end, todo_status)
- [ ] 2.3 Implement auto-continue circuit breaker logic with configurable limit
- [ ] 2.4 Implement abort handling (clear cursor, set isStreaming=false, await dispatch)
- [ ] 2.5 Integrate useStreaming hook into app.js, replacing inline streaming setup

## 3. Command Registry Refactor

- [ ] 3.1 Create `src/tui/utils/commandRegistry.js` with command registration schema (validate, execute, help)
- [ ] 3.2 Create `src/tui/utils/commandHelpers.js` with CommandHelpers interface (dispatchProvider, sessionState, config, scrollRef)
- [ ] 3.3 Migrate all existing commands (/quit, /clear, /new, /help, /config, /provider, /schedule, /gc) to registry format
- [ ] 3.4 Implement unknown command handling with fallback message
- [ ] 3.5 Update app.js to use command registry instead of switch-driven parser

## 4. Panel System Removal

- [ ] 4.1 Remove `src/tui/panels.js`, `src/tui/skillsPanel.js`, `src/tui/memoryPanel.js`, `src/tui/settingsPanel.js`
- [ ] 4.2 Remove panel-related imports and references from app.js
- [ ] 4.3 Verify no remaining panel imports in the codebase
- [ ] 4.4 Update tui-interface spec delta to reflect command-based replacement

## 5. File Relocation

- [ ] 5.1 Move `src/tui/conversationPanel.js` → `src/tui/components/ConversationPanel.js`
- [ ] 5.2 Move `src/tui/inputPanel.js` → `src/tui/components/InputPanel.js`
- [ ] 5.3 Move `src/tui/statusBar.js` → `src/tui/components/StatusBar.js`
- [ ] 5.4 Move `src/tui/messages.js` → `src/tui/components/MessageBubble.js`
- [ ] 5.5 Move `src/tui/banner.js` → `src/tui/components/Banner.js`
- [ ] 5.6 Move `src/tui/onboardingPanel.js` → `src/tui/panels/OnboardingPanel.js`
- [ ] 5.7 Move `src/tui/commandParser.js` → `src/tui/utils/commandParser.js` (renamed during registry refactor)
- [ ] 5.8 Move `src/tui/contextTokens.js` → `src/tui/utils/contextTokens.js`
- [ ] 5.9 Move `src/tui/markdownText.js` → `src/tui/utils/markdownText.js`
- [ ] 5.10 Update all import paths across the codebase

## 6. Status Bar Enhancements

- [ ] 6.1 Add toggle indicator display to StatusBar component
- [ ] 6.2 Integrate toggle state from TUIState into status bar rendering
- [ ] 6.3 Format toggle indicators as `[ts:1 scroll:1]` style strings

## 7. App.js Integration

- [ ] 7.1 Replace useState calls with useReducer in app.js
- [ ] 7.2 Wire up useStreaming hook into handleChat/handleCommand
- [ ] 7.3 Wire up command registry into input submission
- [ ] 7.4 Update StatusBar to consume reducer state
- [ ] 7.5 Remove panel rendering from app.js
- [ ] 7.6 Verify all state transitions work correctly

## 8. Tests — Unit

- [ ] 8.1 Write `tests/unit/tui/reducer.test.js` — all action types, edge cases, empty state
- [ ] 8.2 Write `tests/unit/tui/selectors.test.js` — contextSize display, statusMessage, toggle indicators
- [ ] 8.3 Write `tests/unit/tui/useStreaming.test.js` — event transformation, auto-continue, abort handling
- [ ] 8.4 Write `tests/unit/tui/commandRegistry.test.js` — command validation, execution, unknown commands
- [ ] 8.5 Write `tests/unit/tui/markdownText.test.js` — markdown rendering, streaming cursor stripping, cache behavior
- [ ] 8.6 Write `tests/unit/tui/contextTokens.test.js` — tiktoken calculation, character-count fallback

## 9. Tests — Integration

- [ ] 9.1 Write `tests/integration/tui/full-flow.test.js` — user input → streaming → message display → command execution
- [ ] 9.2 Verify all existing TUI tests pass after refactoring
- [ ] 9.3 Verify 100% coverage on all new files
- [ ] 9.4 Verify existing files maintain current coverage

## 10. Cleanup and Verification

- [ ] 10.1 Run full test suite — all tests must pass
- [ ] 10.2 Verify TUI starts and functions correctly in interactive mode
- [ ] 10.3 Verify streaming, interrupt, scroll, and command functionality
- [ ] 10.4 Verify no lint errors in refactored files
- [ ] 10.5 Verify no remaining references to removed panel files
