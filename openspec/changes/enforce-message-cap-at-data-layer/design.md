## Context

The `MessageList` component in `src/tui/messageList.js` manages conversation messages through four ref-based data structures. Currently, messages are added without any cap at the data layer — the 100-message limit is enforced only at render time via `idsRef.current.slice(-MAX_RENDER_MESSAGES)`. This means the internal state grows unbounded while the UI only displays the last 100 messages.

## Goals / Non-Goals

**Goals:**
- Enforce the 100-message cap at the data layer in `addMessage()` and `setMessages()`.
- Clean up orphaned data (dataRef, contentRef, pub/sub topics) when messages are shifted off.
- Maintain backward compatibility with the existing imperative API surface.
- Add regression tests for the cap enforcement.

**Non-Goals:**
- Making the cap value configurable or parameterized.
- Adding pagination or "load older messages" functionality.
- Modifying session persistence/restore logic outside of messageList.js.
- Changing the render-layer slice (kept as defensive measure).

## Decisions

### Decision 1: Enforce cap in addMessage() after push
After pushing the new message ID to `idsRef.current`, check if length exceeds `MAX_RENDER_MESSAGES`. If so, shift off the oldest ID from index 0 and clean up all associated data structures.

**Rationale:** This is the simplest and most efficient approach. A single check after push handles the common case of one message at a time. The `shift()` operation is O(n) but n is bounded at 100, so the cost is negligible.

**Alternatives considered:**
- Using a circular buffer: More complex, unnecessary for a fixed cap of 100.
- Using `splice(0, 1)` instead of `shift()`: Functionally equivalent, `shift()` is more idiomatic.

### Decision 2: Truncate in setMessages() after building full list
After iterating through all input messages and building the internal state, truncate `idsRef.current` to the last `MAX_RENDER_MESSAGES` entries and rebuild `idToIdxRef`.

**Rationale:** Session restore may pass more than 100 messages. Truncating at the end ensures we keep the most recent 100, consistent with the render-layer behavior.

**Alternatives considered:**
- Truncating during the build loop: Would require tracking indices dynamically, more complex.
- Accepting only 100 messages from the caller: Shifts responsibility to callers, breaks encapsulation.

### Decision 3: Clean up orphaned data on shift
When shifting off a message, delete its entries from `dataRef`, `contentRef`, and its pub/sub topic from `topicsRef`.

**Rationale:** Prevents memory leaks from orphaned message data. The pub/sub topic cleanup is critical — stale callbacks firing on orphaned message IDs could cause unexpected behavior.

## Risks / Trade-offs

### Risk: Streaming message updates on shifted messages
If a streaming assistant message is shifted off before completion, its pub/sub topic is deleted and the streaming updates will be lost.

**Mitigation:** This is acceptable — the message was shifted because it's no longer visible in the UI. Streaming updates for shifted messages are a corner case that the user won't observe. The `updateMessage()` API will silently no-op for shifted messages since `idToIdxRef` won't contain them.

### Risk: Index invalidation after shift
After shifting, all remaining message indices change by -1. `idToIdxRef` must be rebuilt to reflect new indices.

**Mitigation:** Rebuild `idToIdxRef` from scratch after shifting by iterating `idsRef.current` and setting each index. This is O(n) with n ≤ 100, negligible cost.

### Risk: Session restore truncation
If a session has more than 100 messages, only the last 100 will be retained in memory.

**Mitigation:** This is consistent with existing render-layer behavior — the user never saw more than 100 messages anyway. The conversation history is preserved in the session checkpoint; only the in-memory TUI state is truncated.

## Migration Plan

No migration needed. This is a pure code change with no data migration. The behavioral change (messages now actually removed from memory) is consistent with existing render-layer behavior and is invisible to end users.

## Open Questions

None. The implementation approach is clear and well-defined by the audit findings and fix steps.