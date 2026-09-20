## Context

The TUI `MessageList` component (`src/tui/messageList.js`) renders conversation messages as `MessageBubble` components. A render guard at lines 437-443 skips assistant bubbles that are not streaming and have empty `content`. This guard was intended to hide transient/empty assistant bubbles, but it does not account for the `segments` array.

When an assistant response is interrupted (ESC / system interrupt), `streaming` is set to `false` while `content` may remain empty — but `segments` still holds `reasoning` or partial `message` content. The guard filters out such bubbles, so the user loses the visual indicator of what the agent was doing when interrupted.

## Goals / Non-Goals

**Goals:**
- Keep assistant bubbles that carry non-empty `reasoning` or `message` segments, even when `streaming` is false and `content` is empty.
- Preserve the existing skip behavior for genuinely empty assistant bubbles (no content, no segments, not streaming).
- Add a regression test covering the interrupted-bubble scenario.

**Non-Goals:**
- No changes to interrupt handling in `src/tui/conversationArea.js`.
- No changes to `MessageBubble` rendering, styling, or segment coalescing logic.
- No changes to the imperative API surface or public exports.
- No changes to other segment types (e.g., tool-related segments do not keep the bubble).

## Decisions

**Decision: Extend the render guard predicate in `src/tui/messageList.js`.**

The guard currently reads:

```js
if (
  data.role === "assistant" &&
  !data.streaming &&
  !(contentRef.current.get(id) || data.content || "").trim()
) {
  return null;
}
```

Extend it to also keep the bubble when `segments` contains `reasoning` or `message` content:

```js
if (
  data.role === "assistant" &&
  !data.streaming &&
  !(contentRef.current.get(id) || data.content || "").trim() &&
  !(data.segments || []).some(
    (s) => (s.type === "reasoning" || s.type === "message") && (s.content || "").trim()
  )
) {
  return null;
}
```

**Rationale:** This is the minimal, localized change. It keeps the existing skip behavior for empty bubbles while preserving bubbles that carry reasoning or partial message segments. The predicate guards against `segments` being undefined and against whitespace-only content.

**Alternatives considered:**
- *Extract the guard into a testable helper function.* This would improve testability but adds a new export and changes the module surface. The issue's audit notes this as an option, but the minimal fix is preferred to avoid scope creep. The regression test will render the real `MessageList` component to exercise the guard directly.
- *Modify interrupt handling in `conversationArea.js` to populate `content`.* This is a larger behavioral change and does not address the root cause (the guard ignoring `segments`). Rejected.

## Risks / Trade-offs

- [Risk: The extended predicate could keep bubbles that should be hidden] → Mitigation: The predicate only matches `reasoning`/`message` segments with non-empty trimmed content; genuinely empty bubbles (no segments) are still skipped.
- [Risk: `segments` may be undefined] → Mitigation: `(data.segments || [])` guards against this.
- [Risk: Whitespace-only segment content] → Mitigation: `.trim()` is applied before the truthiness check.
