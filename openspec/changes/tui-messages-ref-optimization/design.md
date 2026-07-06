## Context

The TUI app (`src/tui/app.js`) manages conversation messages using React's `useState` hook. During AI response streaming, the `createStreamingHandler` callback is invoked for each chunk, triggering `setMessages` calls that clone the entire message array before modifying the last element. With 19 call sites across the component, this creates substantial unnecessary work — array cloning, React reconciliation, and DOM updates for data that hasn't meaningfully changed.

The `ConversationPanel` component already has optimizations in place: `MessageBubble` is memoized with `areEqual` (line 73-185), `MAX_RENDER_MESSAGES` limits rendering (line 240), and `useMemo` memoizes `renderMessages` output (line 355-358). The bottleneck is entirely in the state management layer — the parent component's `useState` triggers re-renders before these optimizations can help.

## Goals / Non-Goals

**Goals:**
- Eliminate array cloning during streaming message updates
- Reduce re-render frequency during high-chunk-rate streaming via throttling
- Maintain identical visual output and behavioral parity
- Wrap `createStreamingHandler` in `useCallback` to prevent callback reference churn

**Non-Goals:**
- Changes to `ConversationPanel` (already optimized)
- Changes to `messages.js` (pure utilities, no state)
- Migration strategy (this is an internal optimization with no API changes)
- Performance benchmarking (behavioral parity is sufficient)

## Decisions

### Decision 1: useRef + forceRender pattern over useMemo
**Choice:** Use `useRef([])` for mutable storage + `useState(0)` for render triggering.
**Rationale:** `useMemo` is computed during render and doesn't support side effects. A ref provides truly mutable storage that can be updated outside the render cycle. The separate `forceRender` state gives us explicit control over when React re-renders.
**Alternatives considered:**
- `useReducer`: More verbose, overkill for simple array mutation
- `useMemo`: Doesn't support mutable updates, computed during render
- Plain class component state: Unnecessary migration cost

### Decision 2: Throttle interval of 5 ticks
**Choice:** Call `forceRender` every 5 streaming updates.
**Rationale:** Starting with 5 provides a good balance between responsiveness and performance. This can be made configurable via settings if needed. A lower value (2-3) would be more responsive but less performant; a higher value (10+) would be more performant but potentially janky.
**Alternatives considered:**
- Render on every chunk: Defeats the purpose
- Render on chunk boundary only: Complex to implement, depends on LLM provider
- Fixed time-based throttle (e.g., 100ms): Less predictable, depends on chunk rate

### Decision 3: No changes to consumer components
**Choice:** Leave `ConversationPanel` and `messages.js` untouched.
**Rationale:** These components are already optimized. The bottleneck is in the state management layer, not the rendering layer. Changing consumer components would add risk without meaningful benefit.

## Risks / Trade-offs

### Risk: DevTools impact
**Trade-off:** React DevTools will show throttled updates instead of per-chunk updates.
**Mitigation:** DevTools are not used in production. This is an acceptable trade-off.

### Risk: Test compatibility
**Trade-off:** Existing tests that mock `setMessages` will need to read from `messagesRef.current`.
**Mitigation:** Update test assertions to read from the ref. This is a straightforward change.

### Risk: Concurrent mutations
**Trade-off:** Two code paths mutating the ref simultaneously (e.g., streaming handler + todo callback).
**Mitigation:** JavaScript is single-threaded — mutations are synchronous and serialized. No race condition possible.

### Risk: User experience during streaming
**Trade-off:** Throttled updates may feel slightly less responsive during streaming.
**Mitigation:** 5-tick throttle provides good balance. Can be adjusted if user feedback indicates issues.