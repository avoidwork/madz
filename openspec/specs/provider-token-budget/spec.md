# provider-token-budget Specification

## Purpose
TBD - created by archiving change configurable-tokens-per-minute-rate-limiting. Update Purpose after archive.
## Requirements
### Requirement: Rolling token window tracks consumed tokens
The `src/provider/tokenBudget.js` module SHALL maintain a rolling 60-second window of consumed tokens. The `consume(tokens)` function SHALL record a token consumption entry with a timestamp, and `current()` SHALL return the sum of tokens consumed within the last 60 seconds, evicting entries older than 60 seconds.

#### Scenario: consume records tokens in the window
- **WHEN** `consume(1000)` is called
- **THEN** `current()` returns `1000`

#### Scenario: current evicts entries older than 60 seconds
- **WHEN** a token entry is older than 60 seconds
- **THEN** `current()` excludes it from the returned sum

#### Scenario: current returns zero when window is empty
- **WHEN** no tokens have been consumed
- **THEN** `current()` returns `0`

### Requirement: waitForCapacity resolves when the window has room
The `waitForCapacity(estimatedTokens)` function SHALL resolve once the rolling window has room for `estimatedTokens` tokens without exceeding the configured `maxTokensMinute` budget. It SHALL wait (delay) when the window is near capacity and resolve immediately when room is available.

#### Scenario: waitForCapacity resolves immediately when room is available
- **WHEN** `current()` plus `estimatedTokens` is within the budget
- **THEN** `waitForCapacity(estimatedTokens)` resolves without delay

#### Scenario: waitForCapacity waits when the window is near capacity
- **WHEN** `current()` plus `estimatedTokens` exceeds the budget
- **THEN** `waitForCapacity(estimatedTokens)` delays until the window has room, then resolves

#### Scenario: waitForCapacity handles a request larger than the whole budget
- **WHEN** `estimatedTokens` exceeds the entire `maxTokensMinute` budget
- **THEN** `waitForCapacity(estimatedTokens)` waits until the window drains, then resolves

### Requirement: Throttle is disabled when maxTokensMinute is zero
When `maxTokensMinute` is `0`, the token-budget throttle SHALL be disabled. No token consumption is tracked and `waitForCapacity` SHALL resolve immediately without delay.

#### Scenario: disabled path does not track tokens
- **WHEN** `maxTokensMinute` is `0`
- **THEN** `consume()` and `waitForCapacity()` are no-ops and `current()` returns `0`

#### Scenario: disabled path resolves immediately
- **WHEN** `maxTokensMinute` is `0`
- **THEN** `waitForCapacity(estimatedTokens)` resolves immediately regardless of `estimatedTokens`

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

