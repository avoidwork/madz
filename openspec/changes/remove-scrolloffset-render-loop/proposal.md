# Change: Remove scrollOffset State to Eliminate Render Loop Flicker

## Problem

The TUI message list flickers due to an infinite render loop. `ink-scroll-view` manages its own internal scroll position, but `messageList.js` also tracks `scrollOffset` in React state and passes it as a controlled prop. When the user scrolls or new messages arrive, the following cycle occurs:

1. `ink-scroll-view` detects a scroll change and calls `onScroll`
2. `handleScroll` calls `setScrollOffset`, triggering a React re-render
3. The re-render passes the new `scrollOffset` prop back to `ScrollView`
4. `ScrollView` sees the prop changed, re-renders, and calls `onScroll` again
5. Infinite loop → visual flickering

## Root Cause

A classic React anti-pattern: controlling a library's internal state from a parent component. `ink-scroll-view` exposes `scrollOffset` as both an input prop and an internal state variable. When the parent also tracks `scrollOffset` in React state and updates it via `onScroll`, it creates a feedback loop.

## Solution

Remove the parent-controlled `scrollOffset` entirely, letting `ink-scroll-view` manage scroll position internally. The imperative `scrollBy()` ref API on the ScrollView ref still allows keyboard navigation to work correctly.

## Changes

- **src/tui/messageList.js**
  - Remove `const [scrollOffset, setScrollOffset] = useState(0)`
  - Change `scrollBy(delta)` from `setScrollOffset` to `scrollRef.current?.scrollBy?.(delta)`
  - Remove `handleScroll` callback function
  - Remove `scrollOffset` and `onScroll` props from `<ScrollView>`

## Why This Works

`ink-scroll-view` is designed to manage its own scroll position internally. By removing the parent-controlled `scrollOffset`, React stops fighting the library. The `scrollBy` imperative API on the ref still allows keyboard navigation to work.

## Impact

- **Scope**: Single file, single component — `src/tui/messageList.js`
- **Risk**: Low. The change removes state and callbacks; the ref-based `scrollToBottom` path (used for auto-scroll on new messages) is unaffected.
- **Testing**: Verify message list renders without flicker during rapid message additions and keyboard navigation via up/down arrow keys.
