## Why

The TUI works, but its structural decisions compound as it grows. Eight independent `useState` calls with no coordination, streaming logic tangled in handlers, a flat 17-file layout, and a panel system that contradicts the blueprint's "no panels" philosophy. These decisions create cognitive overhead, make testing harder, and slow down future development. The architecture needs consolidation before the TUI grows further.

## What Changes

- **Consolidate state management** — Replace eight independent `useState` calls with a single `useReducer` driven by a `TUIState` interface and typed actions. One state tree, one render cycle per meaningful change.
- **Extract streaming logic** — Move the streaming callback, `AbortController` lifecycle, auto-continue circuit breaker, and event transformation into a dedicated `useStreaming()` hook. Separates *how we stream* from *what we stream*.
- **Reorganize file structure** — Group files by concern into `state/`, `hooks/`, `components/`, `utils/` directories. When you're looking for streaming logic, you know exactly where to look.
- **Remove panel system** — Eliminate `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js`. Skills and memory are inspected via commands (`/skills`, `/memory`) that produce output in the conversation stream, not separate UI surfaces.
- **Refactor command parser** — Replace the switch-driven dispatch table with an event-driven command registry where commands are registered as objects with `validate`, `execute`, and `help` properties.
- **Add runtime toggle indicators** — Show active toggle states (`ts:1 scroll:1`) in the status bar for quick glance visibility.

## Capabilities

### New Capabilities
- `tui-state-management`: Consolidated `useReducer` with `TUIState` interface, typed actions, and selectors for derived state
- `tui-streaming-hook`: Extracted streaming logic into `useStreaming()` hook with `AbortController` lifecycle, event transformation, and auto-continue circuit breaker
- `tui-command-registry`: Event-driven command registration system with `validate`, `execute`, and `help` properties replacing the switch-driven dispatch table

### Modified Capabilities
- `tui-architecture`: File structure reorganization and panel system removal

## Impact

- **Affected code**: `src/tui/app.js` (major refactor), `src/tui/panels.js`, `src/tui/skillsPanel.js`, `src/tui/memoryPanel.js`, `src/tui/settingsPanel.js` (removal), `src/tui/commandParser.js` (rewrite), all TUI component files (relocation)
- **Tests**: All existing TUI tests must pass. New tests for reducer, streaming hook, and command registry required
- **Breaking**: Panel system removal changes the component tree. Any external consumers of panel components will need migration
