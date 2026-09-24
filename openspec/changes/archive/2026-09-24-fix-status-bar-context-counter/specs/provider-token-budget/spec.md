## ADDED Requirements

### Requirement: Context-cost estimation is extracted into a shared helper
The context-cost logic used by the `TokenBudget` middleware (conversation tokens plus the configured output budget) SHALL be extracted into an exported `estimateContextCost` function in `src/provider/tokenBudgetMiddleware.js`. The middleware SHALL delegate to this helper so the middleware and the TUI share the same cost logic, and the helper SHALL be callable regardless of whether `maxTokensMinute` is configured.

#### Scenario: Middleware delegates to the shared helper
- **WHEN** the `TokenBudget` middleware estimates a request cost
- **THEN** it uses the exported `estimateContextCost` helper, so the middleware and the TUI share the same cost logic

#### Scenario: Helper is callable when the budget is disabled
- **WHEN** `maxTokensMinute` is `0` (or unset) and the exported helper is called
- **THEN** it still computes the estimate (it does not depend on the budget being enabled)

#### Scenario: Helper adds the output budget to the conversation estimate
- **WHEN** the exported helper is called with a conversation and `{ model, encoding, maxTokens }`
- **THEN** it returns `calculateConversationTokens(conversation, model, encoding) + (maxTokens || 0)`
