## 1. Add dependency

- [ ] 1.1 Install `ink-scroll-view` via npm
- [ ] 1.2 Verify install completes and package-lock.json is updated

## 2. Refactor ConversationPanel to use ScrollView

- [ ] 2.1 In `conversationPanel.js`, import `ScrollView` from `ink-scroll-view`, plus `useInput`, `useStdout` from `ink`
- [ ] 2.2 In `ConversationPanel`, create a `scrollRef` with `useRef` pointing to `ScrollViewRef`
- [ ] 2.3 In `ConversationPanel`, remove `scrollOffset`, `visibleCount`, `_isScrolling`, and `_onScroll` props -- keep only `messages` and `assistantName`
- [ ] 2.4 Add `useRef` import and `const scrollRef = useRef(null)` in `ConversationPanel`
- [ ] 2.5 Add `useStdout` and `useInput` in `ConversationPanel`
- [ ] 2.6 In `useInput` callback, wire up: `key.upArrow` → `scrollRef.current.scrollBy(-1)`, `key.downArrow` → `scrollRef.current.scrollBy(1)`, `key.pageUp` → `scrollRef.current.scrollBy(-getViewportHeight())`, `key.pageDown` → `scrollRef.current.scrollBy(getViewportHeight())`
- [ ] 2.7 Add `useEffect` in `ConversationPanel` to listen for `stdout` resize events and call `scrollRef.current.remeasure()`, with proper cleanup on unmount
- [ ] 2.8 Move the existing message rendering loop into the ScrollView children (replace wrapping `Box` with `ScrollView`)
- [ ] 2.9 Update the `key` prop on message message boxes to use message-level identifiers (e.g., `"msg-" + i` → `"msg-" + (messages[i]?.id ?? i)`) rather than array index -- `ScrollView` requires stable unique keys

## 3. Simplify app.js

- [ ] 3.1 Remove `scrollOffset` and `isScrolling` `useState` declarations
- [ ] 3.2 Remove the `import { calcVisibleCount, isStreamingMessage } from "./messages.js"` and replace with `import { isStreamingMessage } from "./messages.js"`
- [ ] 3.3 Remove `const visibleCount = calcVisibleCount(rows - 2, 3)` line
- [ ] 3.4 Remove `setScrollOffset(0)` and `setIsScrolling(false)` from the `addMessage` function
- [ ] 3.5 Update the `ConversationPanel` props in `React.createElement` to only pass `messages` and `assistantName` (drop `visibleCount`, `scrollOffset`, `isScrolling`, `onScroll`)
- [ ] 3.6 Remove the `rows` variable from `useWindowSize` if no longer consumed by visibleCount (but keep if needed by other layout logic)

## 4. Clean up messages.js

- [ ] 4.1 Remove the `getVisibleMessages` function export
- [ ] 4.2 Remove the `calcVisibleCount` function export
- [ ] 4.3 Remove the JSDoc typedef block at top (if it only references message virtualization concepts) -- keep the `Message` typedef only if still used by other modules
- [ ] 4.4 Keep exported: `getRoleLabel`, `formatMessage`, `isStreamingMessage`, `countMessageLines`, `getToolCallLines`

## 5. Update tests

- [ ] 5.1 In `tests/unit/tui.test.js`, remove or update tests that import `getVisibleMessages` and `calcVisibleCount` from `messages.js`
- [ ] 5.2 Verify remaining TUI tests still pass after cleanup

## 6. Verify

- [ ] 6.1 Run `npm run fix` (lint + format) and confirm no errors
- [ ] 6.2 Run `npm run test` and confirm all tests pass
- [ ] 6.3 Run `npm run coverage` and confirm coverage remains at or above the pre-change level
