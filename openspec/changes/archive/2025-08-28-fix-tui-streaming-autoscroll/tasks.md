## 1. Expose scrollToBottom() on MessageList's imperative API

- [x] 1.1 Add `scrollToBottom()` method to `imperativeApiRef.current` in messageList.js
- [x] 1.2 Method calls `scrollRef.current.scrollToBottom?.()` with null safety

## 2. Pass scroll imperative to MessageBubble via context

- [x] 2.1 Create `ScrollContext` in messageBubble.js alongside `PubSubContext`
- [x] 2.2 Default context value: `{ scrollToBottom: () => {} }`
- [x] 2.3 Wrap ScrollView children in `ScrollContext.Provider` in messageList.js
- [x] 2.4 Provider value includes `{ scrollToBottom: () => imperativeApiRef.current?.scrollToBottom() }`

## 3. Call scrollToBottom directly from MessageBubble when streaming content grows

- [x] 3.1 In MessageBubble, consume `ScrollContext` via `useContext`
- [x] 3.2 In the pub/sub subscription callback, compare `data.content.length` with previous
- [x] 3.3 If streaming and content grew, call `scrollToBottom()` from context
- [x] 3.4 Track previous content length in a ref to detect growth

## 4. Guard the renderData/prune loop with a length change check

- [x] 4.1 Add `const prevCountRef = useRef(0)` in messageList.js
- [x] 4.2 Guard the renderData slice + prune loop: only run when `currentCount !== prevCountRef.current`
- [x] 4.3 Update `prevCountRef.current = currentCount` after the loop

## 5. Stabilize createStreamingHandler with useCallback

- [x] 5.1 Wrap `createStreamingHandler` in `React.useCallback` in app.js
- [x] 5.2 Dependencies: `addMessage`, `messageListRef`
- [x] 5.3 Verify no stale closure issues with the callback dependencies

## 6. Deduplicate token calculation into a single function with ordering guarantees

- [x] 6.1 Create `updateContextSize(sessionState, config, setContextSize)` helper function in app.js
- [x] 6.2 Helper calculates conversation tokens + system prompt tokens, sets context size
- [x] 6.3 Replace all three duplicate token calc blocks with calls to the helper
- [x] 6.4 Use a ref to track pending token calc and prevent out-of-order updates

## 7. Remove StatusBar React.memo

- [x] 7.1 Remove `React.memo()` wrapper from StatusBar in statusBar.js
- [x] 7.2 Keep the function body identical

## 8. Implement manual scroll-up detection

- [x] 8.1 Add `isUserScrolledUpRef = useRef(false)` in messageList.js
- [x] 8.2 In `handleScroll`, set `isUserScrolledUpRef.current = offset > 0`
- [x] 8.3 In `handleContentHeightChange`, check `isUserScrolledUpRef.current` before calling scrollToBottom
- [x] 8.4 Reset `isUserScrolledUpRef.current = false` when at bottom (offset === 0)
- [x] 8.5 Reset on streaming completion (clear/addMessage triggers)
