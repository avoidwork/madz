## Why

Users need visibility into their conversation's context window size to understand how much of their conversation history is being retained. Currently, the status bar shows message count (`msg:N`) but doesn't distinguish between TUI display messages and actual conversation history. Additionally, when the agent performs conversation compaction (due to context length errors), there's no visual indicator — users have no feedback that compaction is happening.

## What Changes

- Add `context:N` display to the TUI status bar, showing the current number of messages in the session conversation.
- Display `context:N` in red during conversation compaction, returning to default color when compaction completes.
- Emit compaction lifecycle events (`compaction_start`, `compaction_end`) from the streaming agent path.

## Capabilities

### New Capabilities
- `context-window-status`: Display current conversation size in the TUI status bar with reactive updates and compaction visual feedback.

### Modified Capabilities
- *(none — this is a new capability; existing specs are not modified)*

## Impact

- `src/tui/statusBar.js` — add `contextSize` and `isCompacting` props, update rendering
- `src/tui/app.js` — add `contextSize` and `isCompacting` state, handle compaction events
- `src/agent/react.js` — emit `compaction_start` and `compaction_end` events in `callReactAgentStreaming`
- No API changes, no dependency changes, no breaking changes.
