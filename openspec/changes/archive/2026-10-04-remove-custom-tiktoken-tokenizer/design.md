## Context

The context-counting path in madz uses a custom tiktoken-based tokenizer stack that is fundamentally broken. The stack lives in `src/tui/contextTokens.js` (`calculateConversationTokens`, `flattenMessageContent`, `resolveEncoder`, `estimateTokensFromCharacters`, `ENCODING_TO_MODEL`) and is consumed by `src/provider/tokenBudgetMiddleware.js` (`toConversation`, `estimateContextCost`) and `src/tui/conversationArea.js` (`computeContextSize`). The `TokenBudget` middleware's `estimateCost` and the TUI context counter both depend on this broken stack.

The model instance (`ChatOpenAI`) already exposes a canonical tokenizer: `model.getNumTokensFromMessages(messages)` returns `{ totalCount, countPerMessage }`. This is the correct, model-aware way to count tokens and does not require fragile encoding-resolution logic.

## Goals / Non-Goals

**Goals:**
- Delete the broken custom tiktoken tokenizer stack entirely (`src/tui/contextTokens.js`).
- Remove `toConversation` and `estimateContextCost` from `src/provider/tokenBudgetMiddleware.js`.
- Remove `computeContextSize` and all broken tokenizer calls from `src/tui/conversationArea.js`.
- Rewire the context-counting path to use `model.getNumTokensFromMessages(messages)`.
- Thread the `model` instance from `createDeepAgentsOrchestrator` → `index.js` → `App` → `ConversationArea`.

**Non-Goals:**
- No change to token-budget enforcement semantics (rate limiting) beyond cost-estimation rewiring.
- No change to summarization, image-dispatch, or code-interpreter middleware.
- No change to the model factory or provider configuration.

## Decisions

### Decision 1: Use the model's own tokenizer (`getNumTokensFromMessages`)

The model instance exposes `getNumTokensFromMessages(messages)` which returns `{ totalCount, countPerMessage }`. This is the canonical, model-aware tokenizer. The context counter and the `TokenBudget` middleware's `estimateCost` both use this method.

- *Alternative: keep tiktoken.* Rejected — the custom tiktoken stack is fundamentally broken for non-OpenAI models and duplicates logic the model already provides.

### Decision 2: Thread `model` as a prop, not mutated onto the agent

`createDeepAgentsOrchestrator` returns `{ agent, model }`. `index.js` destructures both and passes `model` to the App as a prop. The `model` is NOT mutated onto the `agent` instance — it is passed explicitly through the component tree.

- *Alternative: attach `model` to `agent`.* Rejected — mutating the agent instance is a side effect and couples the agent to the TUI.

### Decision 3: Source messages from `getContextMessages()`

The context counter sources the message array from `getContextMessages()` (the real LangChain message array from the checkpointer), falling back to `sessionState.getConversation()` when the accessor is unavailable. The message array is passed directly to `model.getNumTokensFromMessages(messages)`.

### Decision 4: Rewire `toConversationExchange` in `deepAgents.js`

`toConversationExchange` in `src/agent/deepAgents.js` uses `flattenMessageContent` from the deleted `contextTokens.js`. It is rewired to inline the content-flattening logic so it no longer depends on the deleted module.

## Risks / Trade-offs

- **[Risk] `getNumTokensFromMessages` may not be available on all model instances** → Mitigation: the model is a `ChatOpenAI` instance which exposes the method; the TUI context counter guards on the method's presence.
- **[Risk] Tests referencing removed functions break** → Mitigation: tests for `contextTokens.js`, `streaming-context`, `tokenBudgetMiddleware`, `conversationArea`, and `contextCostFromCheckpointer` are updated or removed.
- **[Risk] The `TokenBudget` middleware's `estimateCost` needs the model** → Mitigation: the middleware wraps model calls, so the model is available in the request context.
