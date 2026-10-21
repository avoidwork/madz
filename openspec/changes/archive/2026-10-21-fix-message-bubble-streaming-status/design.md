## Context

The TUI renders assistant message bubbles via `MessageBubble` (`src/tui/messageBubble.js`). Each bubble tracks a `localStreaming` state initialized from the `streaming` prop and updated via pub/sub (`data?.streaming`). The spinner is rendered when `pendingState` is true: `role === "assistant" && localStreaming && segments.length === 0 && !localContent`.

The `streaming` flag is set to `false` on the message in two places:
- `finalizeStreaming` (`src/tui/conversationArea.js:908`) — the normal completion path, via `updateMessage`.
- `handleInterrupt` (`src/tui/conversationArea.js:171`) — the interrupt path, via `updateMessage`.

When a new message segment (e.g., a system message) is added after an assistant message via `addMessage`, the prior assistant bubble's `streaming` flag is not touched. If the stream was interrupted or errored without `finalizeStreaming`/`handleInterrupt` firing `streaming: false`, the bubble retains a stale `streaming: true` and the spinner persists.

## Goals / Non-Goals

**Goals:**
- Guarantee that every path ending an assistant stream clears the `streaming` flag on the bubble.
- Ensure that adding a subsequent message segment after an assistant message clears any stale `streaming: true` on the prior assistant bubble.
- Provide a defensive fallback in the bubble rendering so a stale `streaming` flag cannot keep a spinner visible once a subsequent segment has arrived.

**Non-Goals:**
- No change to spinner/completed-bubble visual styling.
- No change to streaming content accumulation or segment coalescing.
- No change to session persistence or checkpointing.

## Decisions

### Decision 1: Clear stale `streaming` on the prior assistant bubble when a new message is added

When `addMessage` adds a new message segment, the message list should clear `streaming: false` on any prior assistant message that is still marked streaming. This is the most direct fix for the reported bug: a system message added after an interrupted assistant message will clear the stale spinner.

**Rationale:** `addMessage` is the single entry point for all new message segments (system, user, assistant). Clearing stale streaming flags here guarantees that any subsequent segment ends the prior assistant bubble's spinner, regardless of how the prior stream terminated.

**Alternative considered:** Only fix the error/interrupt paths to always call `finalizeStreaming`. This is insufficient because `addMessage` for a system message does not go through the streaming lifecycle, and there may be paths (e.g., a system message added by a command) that never touch the assistant message's streaming flag.

### Decision 2: Defensive fallback in `MessageBubble` rendering

In `MessageBubble`, the `pendingState` computation should not render a spinner when a subsequent segment has arrived. Since `pendingState` already requires `segments.length === 0 && !localContent`, a bubble with content/segments will not show a spinner. However, to be defensive against a stale `streaming` flag on a bubble that has content, the spinner rendering should be gated on the bubble being genuinely pending (no content and no segments).

**Rationale:** This is a belt-and-suspenders guard. Even if a stale `streaming: true` survives, a bubble with content or segments should never render a spinner.

### Decision 3: Keep `shouldRenderBubble` behavior unchanged

`shouldRenderBubble` keeps an assistant bubble visible if it is streaming OR has non-empty content/segments. This is correct and should not change — an interrupted assistant bubble with reasoning/partial segments must remain visible. The fix is to ensure its `streaming` flag is accurate, not to hide it.

## Risks / Trade-offs

- **[Risk] Clearing `streaming` on a prior assistant bubble could affect a legitimately streaming bubble.** → Mitigation: only clear `streaming` on assistant bubbles that are not the most recently added message and are not currently the active streaming target. The active streaming message is tracked via `streamingMsgIdRef`; we only clear bubbles whose id differs from the active streaming id.
- **[Risk] Over-clearing could hide a genuinely in-progress stream.** → Mitigation: the clear is scoped to the message list's `addMessage` path and only touches assistant bubbles that are marked `streaming: true` but are not the active streaming message.
- **[Risk] Test churn from changing `addMessage` behavior.** → Mitigation: add targeted unit tests for the new clearing behavior and verify existing tests still pass.

## Migration Plan

No migration required. This is a bug fix within the TUI rendering path. Rollback is a revert of the change.

## Open Questions

None.
