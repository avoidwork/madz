## Why

The current TUI implementation works but suffers from structural debt that compounds as the interface grows. Eight independent `useState` calls with no coordination, inline streaming logic scattered across handlers, a flat 17-file layout that doesn't scale, and panel files that contradict the blueprint's "no panels" philosophy. The TUI needs reorganization — not a rewrite, but a structural realignment with the blueprint's four core tenets: input is primary, output is a log, silence is the default, and batteries are included.

## What Changes

- **Consolidate state management**: Replace eight `useState` calls with a single `useReducer` using a `TUIState` interface and typed actions
- **Extract streaming logic**: Move streaming callback, AbortController lifecycle, and auto-continue circuit breaker into a dedicated `useStreaming()` hook
- **Reorganize file structure**: Group files by concern (`state/`, `hooks/`, `components/`, `utils/`) instead of flat layout
- **Remove panel system**: Eliminate `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js` — replace with command-based output in the conversation stream
- **Refactor command parser**: Convert switch-driven dispatch table to event-driven command registry with `validate`, `execute`, and `help` properties
- **Add runtime toggles**: Built-in `/toggle` commands for `autoScroll`, `timestamps`, `commandEcho`, `cursorBreathe`, `debugOutput` — stored in memory, persisted via `config.yaml` on restart
- **Add status bar toggle indicators**: Show active toggle states at a glance (e.g., `[ts:1 scroll:1]`)

## Capabilities

### New Capabilities
- `tui-state-management`: Centralized `useReducer` with `TUIState` interface, typed actions, and selectors
- `tui-streaming-hook`: Extracted `useStreaming()` hook managing AbortController, event transformation, and auto-continue circuit breaker
- `tui-command-registry`: Event-driven command registry replacing switch-driven dispatch table
- `tui-runtime-toggles`: Built-in `/toggle` commands for runtime config overrides with status bar indicators

### Modified Capabilities
- `tui-scrolling`: Enhanced with keyboard scrolling (up/down/page up/page down) when input is unfocused
- `tui-status-bar`: Extended with toggle/filter indicators

## Impact

- **Affected code**: `src/tui/app.js` (major refactor), `src/tui/panels.js`, `src/tui/skillsPanel.js`, `src/tui/memoryPanel.js`, `src/tui/settingsPanel.js` (removal), `src/tui/commandParser.js` (rewrite), `src/tui/index.js` (entry point adjustments)
- **New files**: `src/tui/state/reducer.js`, `src/tui/state/types.js`, `src/tui/state/selectors.js`, `src/tui/hooks/useStreaming.js`, `src/tui/hooks/useScroll.js`, `src/tui/hooks/useInput.js`, `src/tui/hooks/useCommand.js`, `src/tui/utils/format.js`
- **Tests**: New test files under `tests/unit/tui/` for reducer, command parser, context tokens, markdown rendering, and streaming hook
