## Why

The TUI becomes significantly slower as more thinking text is streamed to the user, degrading responsiveness and user experience during extended interactions. As the TUI accumulates streamed thinking text over time, rendering performance degrades noticeably — especially during long-running operations that produce extensive thinking output. The slowdown becomes progressively worse the more text is displayed, indicating fundamental issues with how the TUI handles growing content: unbounded cache growth, O(n) array cloning on every update, full message rendering without virtualization, and excessive scroll operations during streaming.

## What Changes

- Replace unbounded `parseCache` Map in `src/tui/markdownText.js` with a bounded LRU cache (max 500 entries)
- Optimize `setMessages` in `src/tui/app.js` to use immutable update pattern instead of full array spread clone
- Implement debounced scroll-to-bottom in `src/tui/conversationPanel.js` — throttle to 100ms during streaming, immediate on pause
- Implement virtual scrolling in `conversationPanel.js` — render only messages in viewport plus small buffer
- Add performance regression tests to prevent future degradation

## Capabilities

### New Capabilities
- `tui-performance`: Bounded LRU cache, virtual scrolling, and debounced scroll for TUI message rendering

### Modified Capabilities
<!-- No existing spec-level requirements are changing — this is an implementation optimization -->

## Impact

- `src/tui/markdownText.js` — parseCache implementation
- `src/tui/app.js` — setMessages update pattern
- `src/tui/conversationPanel.js` — rendering pipeline, scroll behavior
- `src/tui/messageBubble.js` — potential React.memo optimization
- `ink-scroll-view` — integration with virtual scrolling
- No API or data structure changes — all optimizations are internal to the TUI rendering pipeline