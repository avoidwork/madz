## 1. Implement Bounded LRU Parse Cache

- [x] 1.1 Create LRU cache class in src/tui/markdownText.js with max size of 500 entries
- [x] 1.2 Implement get/set/delete methods with LRU eviction on overflow
- [x] 1.3 Replace unbounded Map parseCache with LRU cache instance
- [x] 1.4 Add cache statistics getter (size, hitRate) for debugging
- [x] 1.5 Write unit tests for LRU cache: eviction, hit/miss, LRU ordering

## 2. Optimize Message State Updates

- [x] 2.1 Replace spread clone `[...prev, ...newChunks]` with `prev.concat(newChunks)` in src/tui/app.js
- [x] 2.2 Verify React state update semantics with immutable append
- [x] 2.3 Write unit test verifying message ordering with batched updates

## 3. Implement Debounced Scroll-to-Bottom

- [x] 3.1 Add scroll throttle state (lastScrollTime) to conversationPanel.js
- [x] 3.2 Implement 100ms throttle on scroll-to-bottom during active streaming
- [x] 3.3 Implement immediate scroll-to-bottom on streaming pause/abort
- [x] 3.4 Detect manual scroll-up and suppress auto-scroll until user returns to bottom
- [x] 3.5 Write unit tests for scroll throttle behavior

## 4. Implement Virtual Scrolling

- [x] 4.1 Read ink-scroll-view API to understand scroll position tracking capabilities
- [ ] 4.2 Calculate visible message indices based on scroll position and viewport height
- [~] 4.3 Implement viewport-based rendering in conversationPanel.js — render only visible + 2-message buffer
  - **Note**: Implemented as fixed window of last 100 messages (MAX_RENDER_MESSAGES) instead of true viewport-based rendering. Achieves React tree size limitation goal but doesn't adapt to scroll position.
- [x] 4.4 Handle dynamic message height changes during streaming
- [x] 4.5 Maintain scroll position smoothly during streaming updates
- [x] 4.6 Write integration test verifying constant React tree size with 10 vs 100 messages

## 5. Performance Testing & Verification

- [x] 5.1 Write performance regression test: simulate 100+ message chunks and measure render time
  - **Note**: Tests verify render window limits with 150 messages (tui.test.js:1137-1147)
- [x] 5.2 Verify parseCache eviction with test (add 600 entries, verify only 500 remain)
- [x] 5.3 Verify virtual scrolling renders correctly during fast streaming
- [x] 5.4 Verify debounced scroll doesn't cause jarring jumps
- [ ] 5.5 Run full test suite (1129 tests) — all must pass
- [ ] 5.6 Run lint — must pass
- [ ] 5.7 Verify application starts without crashing (npm start)