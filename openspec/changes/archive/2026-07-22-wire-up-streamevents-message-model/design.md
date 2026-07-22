## Context

The TUI streaming pipeline currently only captures `message` events from LangChain's `streamEvents`. The message model has fields for `activeToolCall`, `toolCallDisplay`, and `reasoningContent`, but these are never populated because the streaming handler ignores all other event types.

The message model is defined in `src/tui/messages.js`, managed by `MessageList` in `src/tui/messageList.js`, rendered by `MessageBubble` in `src/tui/messageBubble.js`, and the streaming handler lives in `src/tui/app.js`.

## Goals / Non-Goals

**Goals:**
- Add `events` array to the Message model
- Capture all LangChain `streamEvents` event types in the streaming handler
- Populate existing message fields (`activeToolCall`, `toolCallDisplay`, `reasoningContent`) from event data
- Pass events through `addMessage`, `updateMessage`, and `setMessages`

**Non-Goals:**
- Rendering event data in MessageBubble (separate issue)
- Event filtering or compression
- Event persistence beyond the message lifecycle
- Changes to LangChain or DeepAgents libraries

## Decisions

### 1. Store raw events vs. transformed data
**Decision:** Store raw events from `streamEvents` in an `events` array, and separately populate existing fields (`activeToolCall`, `toolCallDisplay`, `reasoningContent`) from event data.

**Rationale:** Raw events preserve all information for future rendering. Transformed data would lose context. The existing fields are populated for backward compatibility with the current rendering path.

### 2. Extend existing fields vs. adding new fields
**Decision:** Extend existing fields (`activeToolCall`, `toolCallDisplay`, `reasoningContent`) rather than adding new ones.

**Rationale:** The rendering path in MessageBubble already handles these fields. Adding new fields would require rendering changes (out of scope). The existing fields are sufficient for the plumbing layer.

### 3. Event capture location
**Decision:** Capture events in `createStreamingHandler` in app.js, the same place where `message` events are currently handled.

**Rationale:** Single responsibility — the streaming handler is already the gateway for all event data flowing to the TUI. Adding event capture here keeps the change localized.

## Risks / Trade-offs

### Risk: Event data bloat
Large tool outputs or verbose chain events could bloat the message model.
→ **Mitigation:** The events array is optional and only populated during streaming. Events are not persisted beyond the message lifecycle.

### Risk: Unknown event structure
The exact structure of LangChain's `streamEvents` varies by model/provider.
→ **Mitigation:** Use defensive coding — check for `event.data?.chunk?.reasoning` etc. with optional chaining. Null/undefined values are handled gracefully.

### Risk: Performance impact
Appending to an array on every event could be slow for high-frequency events.
→ **Mitigation:** The events array is only built during streaming (short-lived). No performance impact on the render path.

## Migration Plan

This is a non-breaking change:
1. Add optional `events` field to Message typedef — existing code unaffected
2. Update `addMessage`/`setMessages` to pass through events — existing callers unaffected (events is optional)
3. Update `createStreamingHandler` to capture events — existing `message` event handling preserved

No rollback needed — the change is additive only.

## Open Questions

- What event types does the configured model/provider actually emit? (Runtime investigation needed)
- Should we filter events by type to avoid storing unnecessary data? (Deferred — raw storage is simpler)
