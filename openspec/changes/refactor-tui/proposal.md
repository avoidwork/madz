## Why

The TUI works but its implementation scaffolding doesn't scale. Eight independent `useState` calls with no coordination, streaming logic scattered inline, a flat 17-file layout, and a panel system that contradicts the blueprint's "no panels" philosophy. As the TUI grows, these structural decisions compound — making it harder to find code, harder to reason about state transitions, and harder to add new features without touching multiple unrelated files.

## What Changes

- **Consolidate state** into a single `useReducer` with a `TUIState` interface, replacing eight independent `useState` calls
- **Extract streaming logic** into a `useStreaming()` hook that manages AbortController lifecycle, translates stream events into state transitions, and handles the auto-continue circuit breaker
- **Reorganize file structure** from flat layout to grouped-by-concern (`state/`, `hooks/`, `components/`, `utils/`)
- **Remove the panel system** (`panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js`) — all panel functionality moves to commands that produce output in the conversation stream
- **Refactor command parser** from switch-driven dispatch table to event-driven command registry with `validate`, `execute`, and `help` properties
- **Add runtime toggle system** (`/toggle` commands) for `autoScroll`, `timestamps`, `commandEcho`, `cursorBreathe`, `debugOutput`
- **Add toggle indicators** to the status bar

## Capabilities

### New Capabilities
- `tui-state-management`: Consolidated `useReducer` state management with `TUIState` interface and typed actions
- `tui-streaming-hook`: Extracted streaming logic into `useStreaming()` hook with AbortController lifecycle and auto-continue circuit breaker
- `tui-file-structure`: Reorganized TUI file structure grouped by concern (`state/`, `hooks/`, `components/`, `utils/`)
- `tui-panel-removal`: Removed panel system; all panel functionality moved to commands producing output in conversation stream
- `tui-command-registry`: Event-driven command registry replacing switch-driven dispatch table
- `tui-runtime-toggles`: Runtime toggle system with `/toggle` commands and status bar indicators

### Modified Capabilities
- `cron-scheduler`: No requirement changes — TUI refactoring is orthogonal to scheduling

## Impact

- **Affected code**: `src/tui/app.js` (major refactor), `src/tui/panels.js`, `src/tui/skillsPanel.js`, `src/tui/memoryPanel.js`, `src/tui/settingsPanel.js` (removal), `src/tui/commandParser.js` (rewrite), all TUI component files (relocation)
- **Tests**: All existing TUI tests must pass; new tests for reducer, streaming hook, command registry
- **Breaking**: Panel system removal changes internal component tree; no external API changes
