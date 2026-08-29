## Capability: TUI Message List — Pending Bubble Cleanup

The TUI message list renders a `MessageBubble` for each message in the conversation. When the user sends a message, an assistant bubble is created immediately with empty content and `streaming: true`, showing a spinner. If the user interrupts (ESC) before any content arrives, the bubble should be removed from the rendered children so no orphaned spinner remains.

### Requirements

1. When building the children array from `renderData`, the last message must be inspected.
2. If the last message has `role === "assistant"`, `content` is empty/falsy, and `streaming === true`, it must be excluded from the rendered children.
3. The removal must happen before the empty-message fallback check so that "No messages yet" renders correctly if the popped bubble was the only one.
4. The underlying data in `dataRef` and `idsRef` is NOT modified — only the rendered children array is filtered. The data layer remains the source of truth; the render layer simply hides the pending bubble.

### Non-goals

- Do not modify `dataRef`, `idsRef`, or `idToIdxRef` — the data layer is untouched.
- Do not add a new tool or API — this is a render-layer fix only.
- Do not change the behavior of `handleInterrupt` or session state cleanup.
