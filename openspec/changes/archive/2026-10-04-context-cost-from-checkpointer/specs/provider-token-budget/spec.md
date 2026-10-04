## MODIFIED Requirements

### Requirement: Context-cost estimation is extracted into a shared helper
The context-cost logic used by the `TokenBudget` middleware (conversation tokens plus the configured output budget) SHALL be extracted into an exported `estimateContextCost` function in `src/provider/tokenBudgetMiddleware.js`. The middleware SHALL delegate to this helper so the middleware and the TUI share the same cost logic, and the helper SHALL be callable regardless of whether `maxTokensMinute` is configured. The helper SHALL accept a conversation array that may contain normalized `{role, content}` messages OR real LangChain messages (with content blocks, tool calls, and tool messages), normalizing them via `toConversation` before tokenization.

#### Scenario: Middleware delegates to the shared helper
- **WHEN** the `TokenBudget` middleware estimates a request cost
- **THEN** it uses the exported `estimateContextCost` helper, so the middleware and the TUI share the same cost logic

#### Scenario: Helper is callable when the budget is disabled
- **WHEN** `maxTokensMinute` is `0` (or unset) and the exported helper is called
- **THEN** it still computes the estimate (it does not depend on the budget being enabled)

#### Scenario: Helper adds the output budget to the conversation estimate
- **WHEN** the exported helper is called with a conversation and `{ model, encoding, maxTokens }`
- **THEN** it returns `calculateConversationTokens(conversation, model, encoding) + (maxTokens || 0)`

#### Scenario: Helper normalizes real LangChain messages before tokenization
- **WHEN** the exported helper is called with a real LangChain message array (content blocks, tool calls, tool messages)
- **THEN** it normalizes the array via `toConversation` and tokenizes the normalized `{role, content}` messages, preserving tool-call/tool-message text

## ADDED Requirements

### Requirement: toConversation normalizes LangChain messages for tokenization
The `toConversation` function in `src/provider/tokenBudgetMiddleware.js` SHALL flatten LangChain messages with content blocks, tool calls, and tool messages into the `{role, content}` shape that `calculateConversationTokens` expects, preserving tool-call/tool-message text so the estimate is not under-counted.

#### Scenario: Content blocks are flattened to text
- **WHEN** a LangChain message has an array of content blocks (e.g., text, image_url)
- **THEN** the blocks are flattened to a single string for tokenization

#### Scenario: Tool calls on assistant messages are preserved
- **WHEN** an assistant message carries `tool_calls`
- **THEN** the tool-call text is included in the normalized content so the estimate is not under-counted

#### Scenario: Tool messages are preserved
- **WHEN** a `tool` role message is present in the message array
- **THEN** its content is included in the normalized conversation
