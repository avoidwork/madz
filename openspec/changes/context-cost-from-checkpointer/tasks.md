## 1. Normalize LangChain messages for tokenization

- [ ] 1.1 Extend `toConversation` in `src/provider/tokenBudgetMiddleware.js` to flatten LangChain messages with content blocks, tool calls, and tool messages into the `{role, content}` shape, preserving tool-call/tool-message text.
- [ ] 1.2 Update `calculateConversationTokens` in `src/tui/contextTokens.js` to correctly tokenize the normalized message array, including content blocks and tool messages, without double-counting.

## 2. Expose the real session to the TUI

- [ ] 2.1 Add a `getContextMessages` accessor in `index.js` that calls `agent.getState(sessionConfig)` and returns `state.values.messages`, degrading gracefully when unavailable.
- [ ] 2.2 Thread `getContextMessages` through the App component (`src/tui/app.js`) down to `ConversationArea` (`src/tui/conversationArea.js`).

## 3. Source the conversation from the checkpointer in the TUI

- [ ] 3.1 In `updateContextSize` in `src/tui/conversationArea.js`, replace `sessionState.getConversation()` with the real message array from the accessor, falling back to `sessionState.getConversation()` when unavailable.
- [ ] 3.2 In `computeContextSize` in `src/tui/conversationArea.js`, accept and use the real message array from the accessor, falling back to `sessionState.getConversation()` when unavailable.

## 4. Add tests

- [ ] 4.1 Add unit tests in `tests/unit/provider/tokenBudgetMiddleware.test.js` covering real LangChain message arrays (content blocks, tool calls, tool messages).
- [ ] 4.2 Add unit tests in `tests/unit/tui/contextTokens.test.js` covering real LangChain message arrays (content blocks, tool calls, tool messages).
- [ ] 4.3 Add an integration test verifying the TUI context counter reflects checkpointer state after a multi-turn conversation with tool calls.

## 5. Verify

- [ ] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions.
