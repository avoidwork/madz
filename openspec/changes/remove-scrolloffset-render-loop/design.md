# Design: Remove scrollOffset State to Eliminate Render Loop Flicker

## Context

`MessageList` in `src/tui/messageList.js` renders a list of `MessageBubble` components inside an `ink-scroll-view` ScrollView. The component previously tracked scroll position using a React state variable `scrollOffset` and passed it as a controlled prop to ScrollView, while also subscribing to `onScroll` callbacks to keep the state in sync.

## Current Architecture (Broken)

```
┌─────────────────────────────────────────────────┐
│                 MessageList                      │
│                                                  │
│  const [scrollOffset, setScrollOffset] = useState(0) │
│                                                  │
│  scrollBy(delta) → setScrollOffset(prev + delta) │
│  handleScroll(offset) → setScrollOffset(offset)  │
│                                                  │
│  <ScrollView                                       │
│    scrollOffset={scrollOffset}  ← controlled prop │
│    onScroll={handleScroll}      ← callback        │
│  >                                               │
│    ...children                                    │
│  </ScrollView>                                    │
└─────────────────────────────────────────────────┘
```

The feedback loop:
1. User scrolls or new message triggers scroll change in ScrollView
2. ScrollView fires `onScroll` with new offset
3. `handleScroll` calls `setScrollOffset(offset)`
4. React re-renders MessageList with new `scrollOffset` prop
5. ScrollView receives new prop, re-renders, fires `onScroll` again
6. Loop repeats every render cycle → flicker

## Target Architecture

```
┌─────────────────────────────────────────────────┐
│                 MessageList                      │
│                                                  │
│  scrollBy(delta) → scrollRef.current?.scrollBy?.(delta) │
│                                                  │
│  <ScrollView                                       │
│    ref={scrollRef}                                │
│    onContentHeightChange={handleContentHeightChange} │
│  >                                               │
│    ...children                                    │
│  </ScrollView>                                    │
└─────────────────────────────────────────────────┘
```

ScrollView owns its scroll position. The parent component only interacts via:
- `scrollToBottom()` ref method — for auto-scroll on new messages
- `scrollBy(delta)` ref method — for keyboard navigation
- `onContentHeightChange` callback — for detecting content growth

## Design Decisions

### Why not fix the loop by debouncing or throttling?

Debounce/throttle would mask the symptom but not the cause. The fundamental problem is that we're controlling a library's internal state from outside. The correct fix is to stop controlling it.

### Why keep `scrollBy` on the imperative API?

Keyboard navigation (up/down arrow keys) needs to scroll the list. Without the controlled state, the only way to scroll is via the ref-based imperative API, which `ink-scroll-view` exposes. This is the intended usage pattern.

### Why keep `handleContentHeightChange`?

This callback is separate from the scroll loop. It fires when content height changes (new messages added) and triggers `scrollToBottom()` if the user hasn't manually scrolled up. It doesn't participate in the feedback loop because it doesn't write to state or pass props back to ScrollView.

### Why keep `isUserScrolledUpRef`?

This ref tracks whether the user manually scrolled away from the bottom. It's used by `handleContentHeightChange` to suppress auto-scroll when the user is reading. It's a ref (not state), so it doesn't trigger re-renders and doesn't participate in the loop.

## Files Changed

- `src/tui/messageList.js` — remove scrollOffset state, update scrollBy, remove handleScroll, clean ScrollView props

## No Spec Deltas Required

This change modifies existing behavior (fixing a bug) without introducing new capabilities or changing the public API surface. The existing spec for the TUI message list remains valid.
