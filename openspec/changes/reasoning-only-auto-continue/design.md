# Design

## Context

See proposal.md — Why. The TUI streaming path consumes events from `consumeStream` in `index.js`, which classifies and forwards events (`message`, `reasoning`, `tool`, `on_tool_start`, `on_tool_end`, and their `subagent_` variants) but does not track the final event type. The message list (`src/tui/messageList.js`) keeps an ordered array of message IDs in `idsRef.current`, with `idToIdxRef` mapping ID → index. Each assistant bubble is created by `runTurn` via `addMessage("assistant", ...)`, which pushes onto `idsRef.current` and returns the new ID into `streamingMsgIdRef.current`.

## Goals / Non-Goals

**Goals:**
- Detect when a turn ends with reasoning as the last non-subagent event.
- Dispatch a silent "Continue" only when the streaming bubble is the last in the message list.
- Bound the auto-continue with a configurable loop guard.
- Keep the detection precise (event-type based, not accumulated-state based).

**Non-Goals:**
- Changing the slash-skill dispatch mechanism.
- Altering reasoning segment rendering in `messageBubble.js`.
- Changes to the underlying provider/dispatch layer beyond threading `lastEventType`.
- Triggering auto-continue for subagent bubbles or clarify resumes.

## Decisions

### Decision 1: Track `lastEventType` at the stream-consumer boundary

`consumeStream` is the single place that classifies and forwards stream events. Add a `let lastEventType = null;` accumulator, set it on every `streamingCallback` call for non-subagent events, and return it in the result object. Subagent events (`subagent_*`) must not set it.

**Alternative considered:** Accumulated-state heuristic in the TUI (`committedReasoningRef.current && !committedContentRef.current.trim()`). Rejected: it infers the condition from accumulated state rather than the actual final event type, and can misfire when reasoning is followed by a tool call.

### Decision 2: Use `getLastMessageId()` for the last-bubble check

Add `getLastMessageId()` to the `messageList.js` imperative API returning `idsRef.current[idsRef.current.length - 1]`. The message list already owns the ordering, so reading the last ID from it is simpler and cannot drift.

**Alternative considered:** Maintaining a Set of active/streaming message IDs and checking membership. Rejected: more machinery, and the ordering is already authoritative in `idsRef.current`.

### Decision 3: Dispatch via `handleChat(text, { silentUser: true })`

`handleChat` with `silentUser: true` is the established silent-dispatch pattern (used at lines 323, 331 of `conversationArea.js`). It adds the prompt to session state without rendering it as a user message, and creates a fresh assistant bubble for the continued response.

**Alternative considered:** Calling `dispatchProvider("Continue", ...)` directly and reusing the same bubble. Rejected: it duplicates the silent-dispatch logic and reuses the bubble, producing a muddled response.

### Decision 4: Gate on three conditions in `runTurn`

After `finalizeStreaming`, dispatch "Continue" only when:
1. `response.lastEventType === "reasoning"`
2. `streamingMsgIdRef.current === messageListRef.current.getLastMessageId()`
3. the loop guard (`autoContinueCountRef` / `config.agent.autoContinueLimit`, default 1000) is not exhausted

This satisfies the per-bubble, last-bubble-only constraint: earlier incomplete bubbles never trigger it.

## Risks / Trade-offs

- **[Infinite loop]** → The `autoContinueCountRef` / `autoContinueLimit` guard bounds the number of silent continues. When exceeded, no further "Continue" is dispatched.
- **[Abort during continue]** → `shouldAbort()` is checked at the top of `handleChat` and in the streaming handler, so an interrupt during the silent continue is handled cleanly.
- **[Empty reasoning]** → If `lastEventType` is not `"reasoning"` (no reasoning, no message), the existing behavior is preserved — no auto-continue.
- **[Tool calls only]** → The detection is gated on `lastEventType === "reasoning"`, so a turn that ended with a tool event is not misclassified.
- **[Concurrent bubbles]** → The last-bubble check via `getLastMessageId()` ensures only the final bubble triggers a continue, even when earlier bubbles are still streaming.

## Migration Plan

No migration needed — this is a behavioral change in the TUI streaming path. Rollback is a revert of the change.

## Open Questions

None.
