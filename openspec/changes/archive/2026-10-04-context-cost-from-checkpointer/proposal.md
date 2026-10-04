## Why

The TUI context counter and the token-budget estimate path are fed `sessionState.getConversation()` — a lossy `{role, content}` array that omits tool calls, reasoning content, multimodal content blocks, and tool messages that the model actually sees. This causes the context counter and budget enforcement to under-report the true context window, diverging from what the model receives.

## What Changes

- Add a `getContextMessages` accessor in `index.js` that reads the real LangChain message array from the checkpointer via `agent.getState(config)` → `state.values.messages`.
- Thread the accessor through the App component (`src/tui/app.js`) down to `ConversationArea` (`src/tui/conversationArea.js`).
- Extend `toConversation` in `src/provider/tokenBudgetMiddleware.js` to flatten LangChain messages with content blocks, tool calls, and tool messages into the `{role, content}` shape `calculateConversationTokens` expects, preserving tool-call/tool-message text.
- Source the conversation from the checkpointer in `updateContextSize` and `computeContextSize` in `src/tui/conversationArea.js`, falling back to `sessionState.getConversation()` when the accessor is unavailable.
- Update `calculateConversationTokens` in `src/tui/contextTokens.js` to correctly tokenize the normalized message array, including content blocks and tool messages, without double-counting.
- Add unit and integration tests covering real LangChain message arrays (content blocks, tool calls, tool messages).

## Capabilities

### New Capabilities
- `context-cost-from-checkpointer`: Estimate context cost from the real LangGraph checkpointer session (`agent.getState(config)` → `state.values.messages`) rather than the lossy `sessionState.getConversation()` array, normalizing LangChain messages (content blocks, tool calls, tool messages) for tokenization.

### Modified Capabilities
- `provider-token-budget`: The `estimateContextCost` helper and `toConversation` normalization must handle real LangChain message arrays (content blocks, tool calls, tool messages) so the middleware and TUI report the same context window the model sees.

## Impact

- `index.js` — add `getContextMessages` accessor and pass it to the App.
- `src/tui/app.js` — thread `getContextMessages` down to `ConversationArea`.
- `src/tui/conversationArea.js` — `updateContextSize` and `computeContextSize` source the conversation from the checkpointer.
- `src/provider/tokenBudgetMiddleware.js` — extend `toConversation` to handle tool calls and tool messages.
- `src/tui/contextTokens.js` — `calculateConversationTokens` tokenizes normalized messages without double-counting.
- Tests: `tests/unit/provider/tokenBudgetMiddleware.test.js`, `tests/unit/tui/contextTokens.test.js`, integration test.

## Non-goals

- Changing how the conversation is displayed or persisted in the TUI.
- Adding new dependencies.
- Changing the token-budget enforcement semantics (only the estimation source changes).
- Refactoring `sessionState.getConversation()` itself.
