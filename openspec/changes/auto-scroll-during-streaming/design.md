## Context

The TUI renders streaming responses via a pub/sub system: `MessageList` publishes content chunks to per-message topics, and `MessageBubble` instances subscribe and append chunks to their local `chunks` state. A `useEffect` then scrolls the ScrollView to bottom.

Two bugs break this chain during streaming:

1. **Pub/sub deduplication** (`handleUpdate` in `messageBubble.js:145-151`) checks `prev[prev.length - 1] === newContent` and returns early. When the streaming handler sends the same content string twice in a row (common during fast token generation), the second chunk is silently dropped. The bubble never re-renders, the scroll effect never fires.

2. **Streaming scroll effect** (`useEffect` in `messageBubble.js:167-183`) only calls `scrollToBottom()` when `text.length > prevContentLengthRef.current`. After the initial scroll-on-stream-start, subsequent scrolls depend on content length growing. When dedup drops a chunk, length doesn't change and no scroll occurs.

## Goals / Non-Goals

**Goals:**
- Skip dedup when `data?.streaming` is true so every streaming chunk is appended.
- Call `scrollToBottom()` on every streaming tick regardless of content length change.
- Add unit tests covering both behaviors.

**Non-Goals:**
- Fix the dead `onContentHeightChange` path in `messageList.js`.
- Refactor pub/sub or scroll architecture.
- Address non-streaming scroll edge cases.

## Decisions

1. **Skip dedup via `streaming` flag rather than removing dedup entirely.** The dedup check is useful for non-streaming updates (e.g., final content writes). We only bypass it when `data?.streaming` is truthy, keeping the optimization for non-streaming paths intact.

2. **Scroll on every streaming tick rather than tracking content length.** During streaming, the `streaming` prop is true and the scroll should follow the stream in real time. Checking content length is unnecessary — we scroll on every render tick while streaming is active.

3. **Minimal change to `handleUpdate`.** The fix is a single guard clause added to the existing dedup check. No restructuring.

## Risks / Trade-offs

- **Increased renders during streaming:** Bypassing dedup means more React renders. However, each render is a single bubble (not the full list), and Ink's render cost is low. The trade-off is acceptable — correct scroll behavior outweighs render optimization.
- **No scroll throttling:** The scroll fires on every streaming tick. If the stream is very fast, this could cause visual flicker. However, Ink's ScrollView handles rapid scroll calls gracefully, and no throttling mechanism exists in the codebase.

## Open Questions

- None. The fix is targeted and the behavior is well-defined.
