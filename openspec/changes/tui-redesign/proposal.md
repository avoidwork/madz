## Why

The current TUI works but suffers from structural debt: eight independent `useState` calls with no coordination, inline streaming logic scattered across handlers, a flat 17-file layout that doesn't scale, and panel files that contradict the core philosophy of "no panels, no tabs, no switching." The interface needs a clean architectural reorganization — consolidating state, extracting streaming into its own hook, grouping files by concern, and removing the panel system entirely — while preserving the four core principles that make the TUI feel right: input is primary, silence is the default, batteries included, and the terminal is the window.

## What Changes

- **State consolidation**: Replace eight independent `useState` calls with a single `useReducer` backed by a `TUIState` interface and typed action types
- **Streaming extraction**: Extract streaming logic (AbortController lifecycle, event transformation, auto-continue circuit breaker) into a dedicated `useStreaming()` hook
- **File reorganization**: Restructure `src/tui/` from a flat layout into a concern-based hierarchy (`state/`, `hooks/`, `components/`, `panels/`, `utils/`)
- **Panel removal**: Remove `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js` — replace with commands (`/skills`, `/memory`) that produce output in the conversation stream
- **Command registry**: Refactor `commandParser.js` from a switch-driven dispatch table to an event-driven command registry with `validate`, `execute`, and `help` properties
- **Runtime toggles**: Implement bitchx-inspired `/toggle` commands for runtime config overrides (autoScroll, timestamps, commandEcho, cursorBreathe, debugOutput)
- **Status bar indicators**: Add toggle/filter status indicators to the status bar for quick glance visibility

## Capabilities

### New Capabilities

- `tui-redesign`: Complete TUI architectural reorganization — state consolidation via `useReducer`, streaming extraction via `useStreaming` hook, file restructuring by concern, panel removal, command registry refactor, and runtime toggle system

### Modified Capabilities

<!-- None — this is a new capability, not a modification of existing spec requirements -->

## Impact

- **Affected code**: `src/tui/app.js` (state management, streaming logic), `src/tui/commandParser.js` (command dispatch), `src/tui/panels.js` (removal), `src/tui/skillsPanel.js` (removal), `src/tui/memoryPanel.js` (removal), `src/tui/settingsPanel.js` (removal)
- **New files**: `src/tui/state/reducer.js`, `src/tui/state/types.js`, `src/tui/state/selectors.js`, `src/tui/hooks/useStreaming.js`, `src/tui/hooks/useScroll.js`, `src/tui/hooks/useInput.js`, `src/tui/hooks/useCommand.js`, `src/tui/components/ConversationPanel.js`, `src/tui/components/InputPanel.js`, `src/tui/components/StatusBar.js`, `src/tui/components/MessageBubble.js`, `src/tui/components/Banner.js`, `src/tui/utils/format.js`
- **Dependencies**: No new external dependencies — uses existing `ink`, `ink-scroll-view`, `pino`, `marked`, `marked-terminal`, `tiktoken`
