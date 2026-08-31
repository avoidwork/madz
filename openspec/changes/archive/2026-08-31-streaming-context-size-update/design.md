## Context

The TUI (`src/tui/app.js`) displays a status bar with context size information (`[⊣ Xk]`). The context size is calculated by `updateContextSize`, which:
1. Retrieves the full conversation from session state
2. Calculates tokens for each message using `calculateConversationTokens` (tiktoken)
3. Loads the system prompt asynchronously and adds its token count
4. Calls `setContextSize` with the total

Currently, `updateContextSize` is called at three points:
- Mount (initial calculation)
- After user message is added to session state
- After assistant response is persisted to session state

The gap between step 2 and step 3 is the streaming window — `dispatchProvider` runs, `createStreamingHandler` accumulates content from `on_chat_model_stream` events, but the context size display remains stale.

## Goals / Non-Goals

**Goals:**
- Update context size display in real-time during streaming
- Use a delta optimization to avoid full conversation recalculation during streaming
- Maintain correctness: final context size after persistence must be authoritative
- Support all streaming call sites (handleChat, handleCommand skill streaming, auto-continue)

**Non-Goals:**
- Changes to the token calculation algorithm
- Changes to system prompt handling during streaming (deferred to post-persistence)
- Changes to the status bar component itself
- Changes to auto-continue logic beyond the streaming handler fix

## Decisions

### Decision 1: Delta-based context update during streaming

**Choice:** Calculate tokens only for the newly accumulated content chunk, add to the pre-stream context size, and update state directly. Apply to both `message` and `on_chat_model_stream` event types.

**Rationale:**
- Full conversation recalculation on every streaming chunk is expensive (iterates all messages, async system prompt load)
- Streaming can deliver many small chunks rapidly; async operations would queue up
- Delta calculation is synchronous and O(1) relative to conversation size
- The delta is exact for the new content; the base (pre-stream size) is already accurate
- Both `message` and `on_chat_model_stream` event types accumulate content that the user sees — both must update context size

**Alternatives considered:**
1. Full recalculation on every chunk — rejected: too expensive, async complications
2. Periodic recalculation (e.g., every N chunks) — rejected: still expensive, less responsive
3. No streaming update, only post-persistence — rejected: defeats the purpose of the fix

### Decision 2: Pass pre-stream context size as a parameter

**Choice:** Capture `contextSize` in a local variable before calling `dispatchProvider`, pass it to `createStreamingHandler` as an additional parameter.

**Rationale:**
- `useCallback` dependencies make it awkward to pass `setContextSize` directly
- A captured value is stable and doesn't require dependency array changes
- The pre-stream size is a snapshot that won't change during the stream

**Alternatives considered:**
1. Pass `setContextSize` as a parameter — rejected: would add to useCallback deps, potential stale closure issues
2. Use a ref for context size — rejected: overengineering for this use case

### Decision 3: Delta calculation uses the same encoding as the full calculation

**Choice:** Use `calculateConversationTokens([{ role: "assistant", content: chunk }], modelName, encoding)` for the delta.

**Rationale:**
- Ensures consistency with the full calculation
- The encoding is resolved the same way (env var → config → model name)
- Simple, single-message tokenization is fast

### Decision 4: Post-persistence full recalculation is preserved

**Choice:** After the assistant response is persisted to session state, call `updateContextSize` as before.

**Rationale:**
- The delta approach doesn't account for system prompt token changes (system prompt load is async)
- The full recalculation is the source of truth
- The delta approach is an optimization for UX; correctness comes from the final recalculation

## Risks / Trade-offs

### Risk: Delta calculation may not account for message format differences
**Mitigation:** The delta uses `{ role: "assistant", content: chunk }` which matches how the assistant message will be persisted. The full recalculation after persistence catches any discrepancies.

### Risk: Multiple concurrent streams (auto-continue) could cause race conditions
**Mitigation:** Each stream has its own `preStreamContextSize` capture. Auto-continue streams start after the previous stream completes, so there's no true concurrency.

### Risk: tiktoken not available (fallback path)
**Mitigation:** `calculateConversationTokens` already handles missing tiktoken by falling back to character-based estimation. The delta approach uses the same function.

### Trade-off: Slightly less accurate during streaming vs. after persistence
**Mitigation:** The inaccuracy is bounded — it only differs from the final value by the system prompt token count (which is constant). The user sees a reasonable approximation in real-time.

## Migration Plan

This is an internal TUI change with no external API impact:
1. Modify `createStreamingHandler` signature to accept `preStreamContextSize`
2. Add delta calculation in the `on_chat_model_stream` handler
3. Update all call sites (handleChat, handleCommand, auto-continue)
4. Add test coverage
5. No rollback needed — changes are isolated to the streaming handler

## Open Questions

None. The approach is straightforward and well-bounded.
