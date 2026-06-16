## Why

The current TUI implementation works but suffers from structural debt that compounds as the interface grows. Eight independent `useState` calls with no coordination, inline streaming logic scattered across multiple functions, a flat 17-file layout that doesn't scale, and a panel system that contradicts the core philosophy ("no panels, no tabs, no switching"). The TUI needs a comprehensive refactor to improve maintainability, performance, and alignment with its design principles: input is primary, silence is the default, batteries included, and the terminal is the window.

## What Changes

- **State management consolidation**: Replace eight independent `useState` calls with a single `useReducer` using a `TUIState` interface and typed actions
- **Streaming logic extraction**: Extract streaming callback, AbortController lifecycle, auto-continue circuit breaker, and event transformation into a dedicated `useStreaming()` hook
- **File structure reorganization**: Group files by concern (state/, hooks/, components/, panels/, utils/) for predictable navigation
- **Panel system removal**: Remove `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js` — replace with `/skills` and `/memory` commands that produce output in the conversation stream
- **Command parser event-driven redesign**: Replace switch-driven dispatch table with a command registry pattern where commands are registered as objects with `validate`, `execute`, and `help` properties
- **Runtime toggle system**: Implement `/toggle` commands for runtime overrides of TUI config (autoScroll, timestamps, commandEcho, cursorBreathe, debugOutput)

## Capabilities

### New Capabilities
- `tui-state-management`: Consolidated `useReducer` state management with typed actions and selectors
- `tui-streaming-hook`: Extracted streaming logic into `useStreaming()` hook with AbortController lifecycle and auto-continue circuit breaker
- `tui-file-structure`: Organized file structure grouped by concern (state/, hooks/, components/, utils/)
- `tui-command-registry`: Event-driven command registry replacing switch-driven dispatch table
- `tui-runtime-toggles`: Runtime toggle commands (`/toggle`) for config overrides without config file editing

### Modified Capabilities
<!-- None — all changes are new capabilities or implementation reorganization -->

## Impact

- **Affected code**: `src/tui/app.js` (state consolidation), `src/tui/commandParser.js` (registry redesign), `src/tui/panels.js` (removal), `src/tui/skillsPanel.js` (removal), `src/tui/memoryPanel.js` (removal), `src/tui/settingsPanel.js` (removal), all TUI component files (reorganization)
- **Dependencies**: No new external dependencies — all changes use existing `ink`, `ink-scroll-view`, `React`
- **Breaking changes**: Panel system removal changes the UI surface; existing panel-related imports will break
