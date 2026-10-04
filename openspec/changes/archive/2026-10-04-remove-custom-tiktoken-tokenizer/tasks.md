## 1. Delete the broken custom tokenizer

- [x] 1.1 Delete `src/tui/contextTokens.js` entirely (the whole file: `calculateConversationTokens`, `flattenMessageContent`, `resolveEncoder`, `estimateTokensFromCharacters`, `ENCODING_TO_MODEL`)
- [x] 1.2 Remove `toConversation` and `estimateContextCost` from `src/provider/tokenBudgetMiddleware.js`; rewire `estimateCost` to use `model.getNumTokensFromMessages(messages)`
- [x] 1.3 Remove `computeContextSize` and its `toConversation`/`estimateContextCost`/`calculateConversationTokens` calls from `src/tui/conversationArea.js`; rewire to `model.getNumTokensFromMessages(messages)`
- [x] 1.4 Remove the streaming path's `calculateConversationTokens` call in `src/tui/conversationArea.js`

## 2. Wire up the model tokenizer

- [x] 2.1 `src/agent/deepAgents.js` — `createDeepAgentsOrchestrator` returns `{ agent, model }`; rewire `toConversationExchange` to not depend on `flattenMessageContent`
- [x] 2.2 `index.js` — destructure `{ agent, model }` and pass `model` to the App as a prop (not mutated onto the agent)
- [x] 2.3 `src/tui/app.js` — add `model` to the App props and pass it to `ConversationArea`
- [x] 2.4 `src/tui/conversationArea.js` — replace the broken count path with a direct `model.getNumTokensFromMessages(messages)` call, where `messages` comes from `getContextMessages()`

## 3. Update tests

- [x] 3.1 Remove/update tests referencing `contextTokens.js` (`tests/tui/contextTokens.test.js`, `tests/unit/tui/contextTokens.test.js`, `tests/unit/streaming-context.test.js`)
- [x] 3.2 Update `tests/unit/provider/tokenBudgetMiddleware.test.js` to drop `toConversation`/`estimateContextCost` and test the model-tokenizer path
- [x] 3.3 Update `tests/unit/tui/conversationArea.test.js` and `tests/integration/contextCostFromCheckpointer.test.js` to use the model tokenizer

## 4. Verify

- [x] 4.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and confirm no regressions
