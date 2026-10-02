## MODIFIED Requirements

### Requirement: Context cost is estimated from conversation, system prompt, and output budget
The TUI context counter SHALL estimate the orchestrator's context window as the sum of the conversation tokens, the full system prompt tokens (SYSTEM_PROMPT plus AGENTS.md), and the configured output token budget (`maxTokens`). The estimate SHALL be computed by a shared helper that is callable regardless of whether `maxTokensMinute` is configured. A `maxTokens` value of `-1` (unlimited) SHALL be treated as `0` (no output budget) so the estimate is not off by one.

#### Scenario: Counter includes conversation, system prompt, AGENTS.md, and maxTokens
- **WHEN** `updateContextSize` computes the context size for a session with a conversation, a system prompt, an AGENTS.md file, and a configured `maxTokens`
- **THEN** the reported count equals conversation tokens + system prompt tokens + AGENTS.md tokens + `maxTokens`

#### Scenario: Counter omits AGENTS.md when the file is absent
- **WHEN** `updateContextSize` runs and `AGENTS.md` cannot be read from the project root
- **THEN** the reported count equals conversation tokens + system prompt tokens + `maxTokens`, and no error is thrown

#### Scenario: Counter adds zero for an unset output budget
- **WHEN** `updateContextSize` runs and `maxTokens` is not configured
- **THEN** the reported count equals conversation tokens + system prompt tokens + AGENTS.md tokens, with no `maxTokens` addition

#### Scenario: Counter treats -1 maxTokens as zero output budget
- **WHEN** `updateContextSize` runs and `maxTokens` is `-1`
- **THEN** the reported count equals conversation tokens + system prompt tokens + AGENTS.md tokens, with no `maxTokens` addition (i.e. `-1` is normalized to `0`)

### Requirement: Context-cost helper is exported and reusable
The context-cost logic (conversation + system prompt + output budget) SHALL be extracted into an exported function in `src/provider/tokenBudgetMiddleware.js` so it can be called from the TUI regardless of whether `maxTokensMinute` is configured. A `maxTokens` value of `-1` SHALL be normalized to `0` in the helper.

#### Scenario: Helper adds maxTokens to the conversation estimate
- **WHEN** the exported helper is called with a conversation and `{ model, encoding, maxTokens }`
- **THEN** it returns `calculateConversationTokens(conversation, model, encoding) + (maxTokens || 0)`

#### Scenario: Helper is callable when the budget is disabled
- **WHEN** the exported helper is called without any `maxTokensMinute` configuration
- **THEN** it still computes the estimate (it does not depend on the budget being enabled)

#### Scenario: Helper normalizes -1 maxTokens to zero
- **WHEN** the exported helper is called with `{ model, encoding, maxTokens: -1 }`
- **THEN** it returns `calculateConversationTokens(conversation, model, encoding) + 0` (i.e. `-1` is normalized to `0`)

#### Scenario: Middleware delegates to the helper
- **WHEN** the token-budget middleware estimates a request cost
- **THEN** it uses the exported helper, so the middleware and the TUI share the same cost logic
