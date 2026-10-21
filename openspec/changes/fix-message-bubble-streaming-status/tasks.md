## 1. Implement streaming-status clearing in message list

- [ ] 1.1 In `src/tui/messageList.js`, modify `addMessage` to clear the `streaming` flag on any prior assistant message that is still marked streaming when a new message segment is added
- [ ] 1.2 Ensure the clearing logic does not affect the active streaming message (tracked via `streamingMsgIdRef`)

## 2. Implement defensive spinner guard in message bubble

- [ ] 2.1 In `src/tui/messageBubble.js`, ensure `pendingState` does not render a spinner when the bubble has non-empty content or segments (defensive guard against stale `streaming: true`)

## 3. Add tests

- [ ] 3.1 Add unit tests for `addMessage` clearing stale `streaming` on a prior assistant message
- [ ] 3.2 Add unit tests for `MessageBubble` not rendering a spinner when a bubble has content/segments despite a stale `streaming: true`

## 4. Verify

- [ ] 4.1 Run `npm run test`
- [ ] 4.2 Run `npm run lint`
- [ ] 4.3 Run `npm run coverage`
