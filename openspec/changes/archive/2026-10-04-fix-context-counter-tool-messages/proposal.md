## Why

The TUI status bar context window counter only updates from assistant message content while streaming. Tool messages (ToolMessage responses) are not counted mid-stream, so the displayed context size is wrong until the turn completes. The final count self-corrects after the stream because `updateContextSize` sources the full message set from the checkpointer via `agent.getState()`. The bug is isolated to the live streaming counter.

## What Changes

- Emit a dedicated `tool_message` streaming event in `callProvider` (`index.js`) carrying the ToolMessage text, regardless of `showToolResults`. The event is emitted before the `continue` so the TUI can count it.
- Add a `toolMessageTokensRef` in `src/tui/conversationArea.js` alongside `tokenCacheRef` to accumulate tool-message token counts during streaming.
- Include tool tokens in the live streaming count in `debouncedContextUpdate` via `onContextUpdate(preStreamContextSize + cached.tokens + toolMessageTokensRef.current)`.
- Reset `toolMessageTokensRef.current` at the start of `handleChat` so tool tokens from a previous turn do not leak into the next.
- Add/extend unit tests covering: (a) a `tool_message` event increments the context counter, (b) `showToolResults: false` still emits the `tool_message` event for counting, (c) the displayed message text is not polluted by tool content.

## Capabilities

### New Capabilities
- `context-counter-tool-messages`: The live streaming context counter SHALL include tool-message tokens as they stream in, decoupled from tool-message display.

### Modified Capabilities
- `context-cost-from-checkpointer`: The live streaming counter now also counts tool-message tokens mid-stream, in addition to the existing post-stream checkpointer-sourced count.

## Impact

- `index.js` — `callProvider` streaming loop: emit `tool_message` events regardless of `showToolResults`.
- `src/tui/conversationArea.js` — `debouncedContextUpdate`, `tokenCacheRef`, `handleChat`: add tool-message token accumulation.
- `tests/unit/tui/conversationArea.test.js` — extend with tool-message counting scenarios.

## Non-goals

- Changing the final post-stream context count (already correct via checkpointer).
- Altering the `showToolResults` display behavior.
- Any changes to token-budget middleware or provider token estimation.
