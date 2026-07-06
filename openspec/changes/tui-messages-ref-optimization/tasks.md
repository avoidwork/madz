## 1. Refactor message state from useState to useRef

- [ ] 1.1 Replace `useState([])` with `useRef([])` for messages storage in app.js
- [ ] 1.2 Add `forceRender` state using `useState(0)` for triggering re-renders
- [ ] 1.3 Add `renderTickRef` using `useRef(0)` for throttle tracking

## 2. Convert setMessages call sites to ref pattern

- [ ] 2.1 Convert direct mutation sites (lines 214, 241, 276, 458, 496, 783) to update messagesRef.current directly
- [ ] 2.2 Convert array operation sites (lines 197, 688) to `messagesRef.current = []`
- [ ] 2.3 Convert filter operation sites (lines 601, 607) to `messagesRef.current = messagesRef.current.filter(...)`
- [ ] 2.4 Convert addMessage site (line 768) to use `messagesRef.current.push(...)`
- [ ] 2.5 Convert finalizeStreaming site (line 812) to direct mutation of last element
- [ ] 2.6 Convert handleInterrupt site (line 648) to simplify streaming flag mutation
- [ ] 2.7 Convert error handler sites (lines 289, 353, 363, 509) to update ref + call forceRender

## 3. Implement throttle strategy for streaming updates

- [ ] 3.1 Add throttle logic to createStreamingHandler that increments renderTickRef
- [ ] 3.2 Call forceRender only every N ticks (default 5) in streaming path
- [ ] 3.3 Ensure non-streaming operations still trigger immediate forceRender

## 4. Memoize createStreamingHandler with useCallback

- [ ] 4.1 Wrap createStreamingHandler in useCallback
- [ ] 4.2 Verify dependency array includes all referenced variables
- [ ] 4.3 Confirm callback reference stability across renders

## 5. Update tests for ref-based approach

- [ ] 5.1 Update tui.test.js to read from messagesRef.current instead of mocking setMessages
- [ ] 5.2 Update any other TUI-related tests that reference message state
- [ ] 5.3 Verify all tests pass with ref-based implementation

## 6. Verify and clean up

- [ ] 6.1 Run npm run test to verify all tests pass
- [ ] 6.2 Run npm run lint to verify no lint errors
- [ ] 6.3 Run npm run coverage to verify coverage is maintained
- [ ] 6.4 Verify application starts without crashing (timeout 10 npm start)
- [ ] 6.5 Confirm no setMessages calls remain in app.js
- [ ] 6.6 Confirm behavioral parity — messages display identically