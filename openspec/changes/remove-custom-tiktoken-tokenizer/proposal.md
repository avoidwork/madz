## Why

The custom tiktoken-based tokenizer stack in the context-counting path is fundamentally broken and must be removed entirely. It relies on fragile tiktoken encoding-resolution logic (`resolveEncoder`, `ENCODING_TO_MODEL`) that does not work for non-OpenAI models, and it duplicates tokenization logic that the model's own tokenizer already provides correctly. Any code that depends on it is also fundamentally broken and must be removed or rewired to the model's own tokenizer.

## What Changes

- **DELETE** `src/tui/contextTokens.js` — the whole file (`calculateConversationTokens`, `flattenMessageContent`, `resolveEncoder`, `estimateTokensFromCharacters`, `ENCODING_TO_MODEL`).
- **DELETE** `src/provider/tokenBudgetMiddleware.js` — `toConversation` and `estimateContextCost`. Rewire the `TokenBudget` middleware's `estimateCost` to use `model.getNumTokensFromMessages()`.
- **DELETE** `src/tui/conversationArea.js` — `computeContextSize` and its `toConversation` / `estimateContextCost` / `calculateConversationTokens` calls. Replace with the model's own tokenizer. The streaming path's `calculateConversationTokens` call is also removed.
- **WIRE UP** `src/agent/deepAgents.js` — `createDeepAgentsOrchestrator` returns `{ agent, model }` (currently returns only `agent`).
- **WIRE UP** `index.js` — destructure `{ agent, model }` and pass `model` to the App as a prop (destructured, NOT mutated onto the agent instance).
- **WIRE UP** `src/tui/app.js` — add `model` to the App props and pass it to `ConversationArea`.
- **WIRE UP** `src/tui/conversationArea.js` — replace the broken count path with a direct `model.getNumTokensFromMessages(messages)` call, where `messages` comes from `getContextMessages()`.

## Capabilities

### New Capabilities
<!-- None — this is a removal/rewiring change, not a new capability. -->

### Modified Capabilities
- `provider-token-budget`: The `estimateContextCost` and `toConversation` requirements are removed. The `TokenBudget` middleware's cost estimation is rewired to use the model's own `getNumTokensFromMessages()`.
- `context-estimation`: The context-cost helper requirement is removed. The TUI context counter is rewired to use `model.getNumTokensFromMessages()`.
- `context-cost-from-checkpointer`: The message-normalization requirement is removed. The context counter sources messages from `getContextMessages()` and counts them via the model's own tokenizer.

## Impact

- `src/tui/contextTokens.js` — deleted.
- `src/provider/tokenBudgetMiddleware.js` — `toConversation` and `estimateContextCost` removed; `estimateCost` rewired to `model.getNumTokensFromMessages()`.
- `src/tui/conversationArea.js` — `computeContextSize` removed; context counting rewired to `model.getNumTokensFromMessages(messages)`.
- `src/agent/deepAgents.js` — `createDeepAgentsOrchestrator` returns `{ agent, model }`; `toConversationExchange` rewired (it used `flattenMessageContent`).
- `index.js` — destructures `{ agent, model }`, passes `model` to App.
- `src/tui/app.js` — accepts `model` prop, passes to `ConversationArea`.
- Tests referencing the removed functions are updated or removed.

## Non-goals

- No change to the token-budget enforcement semantics (rate limiting) beyond the cost-estimation rewiring.
- No change to the summarization, image-dispatch, or code-interpreter middleware.
- No change to the model factory or provider configuration.
