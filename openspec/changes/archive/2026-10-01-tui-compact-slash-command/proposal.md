## Why

The madz TUI has no way for a user to manually compress the context window on demand. As a conversation accumulates messages — especially those containing base64 image data from the `readImage` tool — the context window grows disproportionately expensive in tokens and can approach the model's context limit. Users need a manual escape hatch to compact the window without waiting for automatic summarization or hitting a context-length error.

## What Changes

- Add a `/compact` slash command to the TUI command parser dispatch table (`src/tui/commandParser.js`) that returns `{ action: "compact" }`.
- Handle `result.action === "compact"` in `src/tui/conversationArea.js` `handleCommand`, invoking a compaction routine and reporting the result via `onStatusChange`.
- Expose a `compactContext` callback from the agent (`src/agent/deepAgents.js`) and thread it through `index.js` → `src/tui/app.js` → `ConversationArea`.
- Implement the compaction routine: walk the agent's message state, remove messages containing vision blocks (a `readImage` ToolMessage whose content JSON has a non-empty `data` field, and/or messages with `image_url` content blocks), and trim/summarize the remaining older messages so the context window is compressed.
- Update both the checkpointer state (via `agent.updateState`) and `sessionState.getConversation()` so the TUI and model agree.
- Recompute `contextSize` via `updateContextSize` after compaction so the status bar reflects the reduced window.
- Add `/compact` to the command help list in `src/tui/commandHelp.js`.

## Capabilities

### New Capabilities
- `tui-compact-command`: The `/compact` slash command in the TUI that manually compresses the context window on demand, removes messages containing vision blocks (base64 image data), and trims/summarizes older messages so the context window is reduced.

### Modified Capabilities
- `tui-conversation`: The `handleCommand` function gains a branch for `result.action === "compact"` that invokes the compaction routine and recomputes the context size.

## Impact

- `src/tui/commandParser.js` — register `/compact` in the dispatch table.
- `src/tui/commandHelp.js` — add `/compact` to the command help list.
- `src/tui/conversationArea.js` — handle `result.action === "compact"`, invoke compaction, report via `onStatusChange`, recompute `contextSize`.
- `src/tui/app.js` — accept and thread the `compactContext` prop into `ConversationArea`.
- `src/agent/deepAgents.js` — expose `compactContext` on the agent.
- `index.js` — bind and pass `compactContext` into the `App` props.
- `src/session/stateManager.js` — `getConversation`/`loadConversation` used to keep TUI and model state in sync.
- Tests: `tests/unit/tui/commandParser.test.js`, `tests/unit/tui/conversationArea.test.js`, and new tests for the compaction routine.
