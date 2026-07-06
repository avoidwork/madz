## 1. Refactor message state from useState to useRef

- [x] 1.1 Replace `useState([])` with `useRef([])` for messages storage in app.js
- [x] 1.2 Add `forceRender` state using `useState(0)` for triggering re-renders

## 2. Convert setMessages call sites to ref pattern

- [x] 2.1 Convert direct mutation sites (lines 214, 241, 276, 458, 496, 783) to update messagesRef.current directly
- [x] 2.2 Convert array operation sites (lines 197, 688) to `messagesRef.current = []`
- [x] 2.3 Convert filter operation sites (lines 601, 607) to `messagesRef.current = messagesRef.current.filter(...)`
- [x] 2.4 Convert addMessage site (line 768) to use `messagesRef.current.push(...)`
- [x] 2.5 Convert finalizeStreaming site (line 812) to direct mutation of last element
- [x] 2.6 Convert handleInterrupt site (line 648) to simplify streaming flag mutation
- [x] 2.7 Convert error handler sites (lines 289, 353, 363, 509) to update ref + call forceRender

## 3. Verify and clean up

- [x] 3.1 Run npm run test to verify all tests pass (1072/1072)
- [x] 3.2 Confirm no setMessages calls remain in app.js
- [x] 3.3 Confirm behavioral parity — messages display identically