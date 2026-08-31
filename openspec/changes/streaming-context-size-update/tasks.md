## 1. Modify createStreamingHandler signature

- [ ] 1.1 Add `preStreamContextSize` parameter to `createStreamingHandler` callback signature
- [ ] 1.2 Add `onContextUpdate` optional callback parameter to `createStreamingHandler`
- [ ] 1.3 Update JSDoc to document the new parameters

## 2. Implement delta-based context update during streaming

- [ ] 2.1 In the `on_chat_model_stream` handler, after accumulating content, calculate the token delta using `calculateConversationTokens`
- [ ] 2.2 Call `onContextUpdate` with the new context size (preStreamContextSize + delta) when content is present
- [ ] 2.3 Guard against missing content chunks — skip context update when `event.data.chunk.content` is absent

## 3. Update all call sites to pass streaming context parameters

- [ ] 3.1 In `handleChat`: capture `contextSize` state before calling `dispatchProvider`, pass as `preStreamContextSize` and create an `onContextUpdate` callback that calls `setContextSize`
- [ ] 3.2 In `handleCommand` skill streaming: same pattern — capture and pass context size
- [ ] 3.3 In auto-continue branches (both handleChat and handleCommand): same pattern — capture and pass context size

## 4. Add test for streaming context size updates

- [ ] 4.1 Read existing tests in `tests/unit/tui.test.js` to understand the testing patterns
- [ ] 4.2 Write a test that verifies `createStreamingHandler` calls `onContextUpdate` with the correct delta when `on_chat_model_stream` events are received
- [ ] 4.3 Write a test that verifies no context update occurs when chunks have no content

## 5. Verify and lint

- [ ] 5.1 Run `npm run lint` to verify no lint errors
- [ ] 5.2 Run `npm run test` to verify all tests pass
