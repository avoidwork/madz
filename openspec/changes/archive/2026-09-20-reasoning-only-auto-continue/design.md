# Design: Reasoning-only auto-continue

## Context

The TUI's `src/tui/conversationArea.js` handles streaming responses. When a turn completes, `finalizeStreaming` sets `streaming: false` and `turnDuration`, which stops the message-bubble timer. The existing auto-continue block (lines ~304–351) fires only when `!responseContent.trim()` — i.e., when there is no content at all. It does not detect the case where the model produced reasoning but no message content.

When a model ends its turn after thinking (reasoning present, no message), the user is left with a reasoning-only bubble. The existing auto-continue either doesn't fire (because `committedReasoningRef` is non-empty but `committedContentRef` is empty — the condition `!responseContent.trim()` is true, so it *would* fire) or, when it does fire, it reuses the same `streamingMsgIdRef` bubble and appends the continued output to it, producing a muddled bubble rather than a clean fresh response.

## Goals / Non-Goals

**Goals:**
- Detect when a turn ends with reasoning present but no message content.
- Dispatch a silent "Please continue." prompt that is not rendered in the TUI.
- Render the continued response in a fresh assistant bubble with its own timer.
- Preserve the `autoContinueCountRef` / `config?.agent?.autoContinueLimit` loop guard.

**Non-Goals:**
- Changing the slash-skill dispatch mechanism.
- Altering reasoning segment rendering in `messageBubble.js`.
- Changes to the underlying provider/dispatch layer.

## Decisions

### Decision 1: Reuse `handleChat(text, { silentUser: true })` instead of calling `dispatchProvider` directly

The existing auto-continue calls `dispatchProvider("Please continue.", ...)` directly and reuses the same bubble. Switching to `handleChat(text, { silentUser: true })` gives us two things for free:

1. **Silent dispatch** — the prompt is added to session state but not rendered as a user message in the TUI (lines 246–251).
2. **Fresh bubble** — `handleChat` creates a new assistant message via `addMessage("assistant", "", ...)` (line 260), so the continued response streams into a clean bubble.

This mirrors the slash-skill invocation at line 220, which is the established pattern for silent dispatch.

**Alternative considered:** Keep calling `dispatchProvider` directly but add a fresh `addMessage` call. Rejected because it duplicates the silent-dispatch logic and the fresh-bubble creation that `handleChat` already handles.

### Decision 2: Trigger on the streaming-completion signal

The trigger is `finalizeStreaming` setting `streaming: false` and `turnDuration` — the same signal that stops the message-bubble timer. After `finalizeStreaming(...)` returns, check the condition:

```js
if (committedReasoningRef.current && !committedContentRef.current.trim()) {
  // dispatch silent continue
}
```

This is the natural completion point: the turn has ended, the timer has stopped, and we know whether reasoning-only occurred.

### Decision 3: Preserve the loop guard

Keep `autoContinueCountRef` and the `config?.agent?.autoContinueLimit` (default 1000) cap. The reasoning-only continue is a form of auto-continue, so it must be bounded. When the limit is reached, the existing "Model appears stuck" message fires.

## Risks / Trade-offs

- **[Infinite loop]** → The `autoContinueCountRef` / `autoContinueLimit` guard bounds the number of silent continues. When exceeded, the existing stuck message fires.
- **[Abort during continue]** → `shouldAbort()` is checked at the top of `handleChat` and in the streaming handler, so an interrupt during the silent continue is handled cleanly.
- **[Empty reasoning]** → If `committedReasoningRef.current` is empty (no reasoning, no message), the existing behavior is preserved — no auto-continue.
- **[Tool calls only]** → The reasoning-only detection is gated on `committedReasoningRef.current` being non-empty, so a turn that ended with tool calls but no message is not misclassified.

## Migration Plan

No migration needed — this is a behavioral change in the TUI streaming path. Rollback is a revert of the change.

## Open Questions

None.
