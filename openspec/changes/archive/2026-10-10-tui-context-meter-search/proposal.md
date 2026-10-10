## Why

The TUI status bar currently shows a bare `contextSize` number, which is not intuitive — users cannot tell at a glance how much of the context window is consumed. Long conversations are also hard to navigate; in-conversation search lets users filter and jump to specific messages without scrolling through the whole transcript.

## What Changes

- **Context-window meter**: Replace the bare `contextSize` number in `src/tui/statusBar.js` with a visual bar (e.g. `[▮▮▮▯▯▯] 62%`) showing the proportion of the context window used, colored via the existing `getContextUtilizationColor` helper. Falls back to the bare number when `contextWindow <= 0`.
- **In-conversation search**: Bind Ctrl+F to toggle search mode, filter/search messages with match highlighting, and jump-to-next through results. Builds on the virtualized `src/tui/scrollView.js` and `src/tui/messageList.js`.

## Capabilities

### New Capabilities
- `tui-context-meter`: The TUI status bar renders a visual context-window utilization meter instead of a bare token count.
- `tui-conversation-search`: The TUI conversation supports in-conversation search (Ctrl+F) with match highlighting and jump-to-next.

### Modified Capabilities
- `context-window-status`: The status bar context display changes from a bare `context:N` number to a visual meter showing utilization percentage.
- `tui-message-list`: The MessageList gains search state, match computation, highlight rendering, and jump-to-next imperative API.

## Impact

- **Code**: `src/tui/statusBar.js`, `src/tui/messageList.js`, `src/tui/scrollView.js`, `src/tui/app.js`, `src/tui/inputArea.js`, `src/tui/messageBubble.js`.
- **Tests**: `tests/unit/tui/statusBar.test.js`, `tests/unit/tui/messageList.test.js`, `tests/unit/tui/app.test.js`.
- **Dependencies**: No new runtime dependencies. Search/filter logic is implemented in-house with regex escaping to prevent injection.
- **Config**: No config schema changes.

## Non-goals

- No new runtime dependencies.
- No separate search panel.
- No persistence of search state across sessions.
- No change to the `contextSize`/`contextWindow` data flow.
