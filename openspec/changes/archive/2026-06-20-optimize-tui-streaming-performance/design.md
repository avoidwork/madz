## Context

The TUI (`src/tui/`) renders streaming thinking text through a pipeline that includes markdown parsing (`markdownText.js`), message state management (`app.js`), and UI rendering (`conversationPanel.js` with `MessageBubble`). As conversations grow, four bottlenecks compound:

1. **Unbounded cache**: `parseCache` in `markdownText.js` grows without limit
2. **O(n) array cloning**: `setMessages` clones the entire messages array on every streaming event
3. **Full rendering**: `conversationPanel.js` creates React elements for all messages on every render
4. **Excessive scroll**: `remeasure()` + `scrollToBottom()` called on every streaming tick

Current state: No virtualization, no cache eviction, no scroll throttling.

## Goals / Non-Goals

**Goals:**
- Eliminate unbounded memory growth from parse cache
- Reduce setMessages complexity from O(n) to O(k) where k = new chunks
- Maintain constant React tree size regardless of conversation length
- Reduce scroll operations during streaming by ~90%
- Preserve existing UX: smooth scrolling, manual scroll support, no jarring jumps

**Non-Goals:**
- Changing the message data structure or streaming API
- Adding new UI components or features
- Migrating away from `ink-scroll-view`
- Server-side rendering changes

## Decisions

### Decision 1: LRU Cache with 500-entry limit
**Choice:** Bounded LRU cache replacing unbounded Map
**Rationale:** Markdown content in thinking text repeats patterns (code blocks, lists, headings). A 500-entry cache provides high hit rates while capping memory at ~2-5MB. LRU eviction is simple, deterministic, and doesn't require complex scoring.
**Alternatives considered:**
- FIFO cache: Simpler but evicts recently-used entries unnecessarily
- TTL-based cache: More complex, thinking text doesn't "expire" in a time-based sense
- No cache: Unacceptable — parsing is the bottleneck

### Decision 2: Immutable append instead of spread clone
**Choice:** `prev.concat(newChunks)` or splice-based update
**Rationale:** `concat()` creates a new array with only the new elements copied, avoiding the O(n) spread of the entire existing array. This is a drop-in replacement with identical semantics.
**Alternatives considered:**
- Immutable.js: Overkill for this use case, adds dependency
- Array buffer with pointer: Complex, breaks React state semantics
- Batch updates: Would require restructuring the streaming pipeline

### Decision 3: Throttled scroll with manual scroll detection
**Choice:** Timestamp-based throttle (100ms) during streaming, immediate scroll on pause, suppress during manual scroll-up
**Rationale:** Users don't need to see every intermediate streaming state. A 100ms throttle reduces scroll operations by ~90% while maintaining smooth UX. Detecting manual scroll-up prevents fighting the user's intent.
**Alternatives considered:**
- Debounce (wait until streaming pauses): Too slow — user sees stale content
- No scroll optimization: Unacceptable — causes jank during streaming
- RequestAnimationFrame-based scroll: More complex, marginal gain over 100ms throttle

### Decision 4: Viewport-based rendering with ink-scroll-view
**Choice:** Use ink-scroll-view's scroll position API to calculate visible message indices, render only viewport + 2-message buffer
**Rationale:** `ink-scroll-view` already tracks scroll position. We can calculate which messages are visible and only create React elements for those. This keeps the React tree size constant regardless of conversation length.
**Alternatives considered:**
- Custom virtualization layer: Reinventing the wheel, ink-scroll-view already has position tracking
- Windowed rendering with fixed heights: Doesn't work well with variable-height markdown content
- Full re-render with React.memo only: Already doing this, still creates all elements

## Risks / Trade-offs

### Risk: ink-scroll-view doesn't support dynamic content well
**Mitigation:** Test with streaming content. If dynamic height changes cause layout issues, implement a simple height estimation layer that updates on content change.

### Risk: Virtual scrolling with variable-height content is complex
**Mitigation:** Start with estimated heights, refine with actual measurements. The 2-message buffer above/below viewport provides visual continuity even if height estimates are slightly off.

### Risk: LRU cache eviction reduces hit rate over time
**Mitigation:** 500 entries is generous for thinking text patterns. Monitor cache hit rate in development. If hit rate drops below 70%, increase to 1000 entries.

### Risk: Throttled scroll may feel unresponsive to power users
**Mitigation:** Immediate scroll on streaming pause compensates. Users who want real-time updates can observe the streaming indicator. The 100ms throttle is imperceptible for most users.

## Migration Plan

This is an internal optimization with no API changes. Deployment is straightforward:
1. Merge PR to main
2. No database migrations needed
3. No configuration changes needed
4. Rollback: revert the PR — no data loss, no user impact

## Open Questions

1. What is the average conversation length in messages? This helps validate the 500-entry cache size.
2. Does ink-scroll-view expose scroll position updates via callback or only via state? This affects how we calculate visible messages.
3. What is the current cache hit rate for markdown parsing? This helps validate the LRU approach.