## Context

The TUI status bar context window counter is computed live during streaming by `debouncedContextUpdate` in `src/tui/conversationArea.js`. It currently counts only assistant message content (`committedContentRef.current`) via `model.getNumTokensFromMessages([new AIMessage(text)])`, then reports `preStreamContextSize + cached.tokens`. Tool messages (ToolMessage responses) are not counted mid-stream, so the displayed context size is wrong until the turn completes.

The final count self-corrects after the stream because `updateContextSize` sources the full message set from the checkpointer via `getContextMessages()` → `agent.getState()`. The bug is isolated to the live streaming counter.

In `index.js`, `callProvider` gates ToolMessages behind the `showToolResults` flag. When `showToolResults` is `false` (default), ToolMessages are `continue`d at line ~239 and never emitted to the TUI. When `true`, ToolMessage text flows through as `message` events and is folded into `committedContentRef.current` (mis-counts and corrupts display).

## Goals / Non-Goals

**Goals:**
- Emit a dedicated `tool_message` streaming event carrying the ToolMessage text regardless of `showToolResults`, so the TUI can count it.
- Accumulate tool-message token counts during streaming in a dedicated ref.
- Include tool tokens in the live streaming context counter.
- Reset the tool-message ref per turn to prevent cross-turn leakage.
- Add unit tests covering counting, `showToolResults: false` emission, and display non-pollution.

**Non-Goals:**
- Changing the final post-stream context count (already correct via checkpointer).
- Altering the `showToolResults` display behavior.
- Any changes to token-budget middleware or provider token estimation.

## Decisions

### Decision 1: Emit a dedicated `tool_message` event before the `continue`
In `callProvider`, when a ToolMessage is encountered and `showToolResults` is `false`, emit `streamingCallback({ type: "tool_message", text })` *before* the `continue`. This decouples counting from display: the TUI counts the tool text but never renders it as assistant content. When `showToolResults` is `true`, the ToolMessage text already flows through as `message` events; to keep counting consistent we also emit `tool_message` for that path (or rely on the existing `message` path). The chosen approach: emit `tool_message` for the tool text in both branches, but only `continue` (skip display) when `showToolResults` is `false`.

**Alternatives considered:**
- Reusing the existing `message` event for tool text when `showToolResults` is `false`: rejected because it would pollute the displayed assistant content.
- Counting tool tokens only at turn end: rejected because the bug is specifically the live counter.

### Decision 2: Add `toolMessageTokensRef` alongside `tokenCacheRef`
Introduce `const toolMessageTokensRef = useRef(0)` in `conversationArea.js`. In the streaming handler, on `tool_message` events, compute the token count for the tool text via `model.getNumTokensFromMessages([new AIMessage(text)])` and accumulate into `toolMessageTokensRef.current`. This mirrors the existing `tokenCacheRef` pattern.

### Decision 3: Include tool tokens in the streaming count
In `debouncedContextUpdate`, change the update to `onContextUpdate(preStreamContextSize + cached.tokens + toolMessageTokensRef.current)` so tool messages are counted live.

### Decision 4: Reset the tool-message ref per turn
Clear `toolMessageTokensRef.current = 0` at the start of `handleChat` so tool tokens from a previous turn do not leak into the next.

## Risks / Trade-offs

- [Tool text token count computed per event] → Mitigation: reuse the `tokenCacheRef`-style caching pattern; only recompute when the accumulated tool text changes.
- [Double-counting when `showToolResults` is `true`] → Mitigation: ensure the `tool_message` event is emitted only for the tool text, and the `message` path is not also counting the same tool text. The design keeps `tool_message` as the single counting source for tool text.
- [Display pollution] → Mitigation: `tool_message` events are handled separately from `message` events in the streaming handler; they never touch `committedContentRef.current`.
