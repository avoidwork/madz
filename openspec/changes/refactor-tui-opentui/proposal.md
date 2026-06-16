## Why

The current TUI (`src/tui/app.js`) is a single monolithic file with eight independent `useState` calls, inline streaming logic, and a flat 17-file structure that doesn't scale. As the TUI grows, state coordination, streaming complexity, and file navigation all compound. The TUI.md blueprint documents the architectural debt and proposes a reorganization that groups code by concern, extracts streaming into its own hook, consolidates state into `useReducer`, and removes the panel system that contradicts the blueprint's philosophy.

## What Changes

- **State consolidation**: Replace eight `useState` calls with a single `useReducer` using a `TUIState` interface and typed actions
- **Streaming extraction**: Move streaming callback logic (AbortController, event transformation, auto-continue circuit breaker) into a dedicated `useStreaming()` hook
- **File structure reorganization**: Group files by concern into `state/`, `hooks/`, `components/`, `utils/` subdirectories
- **Panel system removal**: Remove `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js` — replace with commands (`/skills`, `/memory`) that produce output in the conversation stream
- **Command parser evolution**: Shift from switch-driven dispatch to event-driven command registry with `validate`, `execute`, `help` properties
- **Runtime toggles**: Implement built-in `/toggle` commands for `autoScroll`, `timestamps`, `commandEcho`, `cursorBreathe`, `debugOutput`
- **Status bar enhancement**: Add toggle/filter indicators to show active runtime features at a glance

## Capabilities

### New Capabilities
- `tui-state-management`: Consolidated `useReducer` state with typed actions, selectors, and a single `TUIState` interface
- `tui-streaming-hook`: Extracted streaming logic into `useStreaming()` hook with AbortController lifecycle, event transformation, and auto-continue circuit breaker
- `tui-command-registry`: Event-driven command registry with validate/execute/help schema replacing switch-driven dispatch
- `tui-runtime-toggles`: Built-in `/toggle` commands for runtime config overrides stored in state
- `tui-file-structure`: Organized file tree grouped by concern (state/, hooks/, components/, utils/)

### Modified Capabilities
- `cron-scheduler`: Status bar context size display may shift from inline calculation to selector-derived state

## Impact

- **Affected code**: `src/tui/app.js` (primary refactor target), `src/tui/panels.js`, `src/tui/skillsPanel.js`, `src/tui/memoryPanel.js`, `src/tui/settingsPanel.js`, `src/tui/commandParser.js`
- **New files**: `src/tui/state/reducer.js`, `src/tui/state/types.js`, `src/tui/state/selectors.js`, `src/tui/hooks/useStreaming.js`, `src/tui/hooks/useScroll.js`, `src/tui/hooks/useInput.js`, `src/tui/hooks/useCommand.js`, `src/tui/components/ConversationPanel.js`, `src/tui/components/InputPanel.js`, `src/tui/components/StatusBar.js`, `src/tui/components/MessageBubble.js`, `src/tui/components/Banner.js`, `src/tui/utils/format.js`
- **Removed files**: `src/tui/panels.js`, `src/tui/skillsPanel.js`, `src/tui/memoryPanel.js`, `src/tui/settingsPanel.js`
- **Breaking changes**: None for end users — all changes are internal reorganization. Commands (`/quit`, `/clear`, `/toggle`, etc.) remain the same.
