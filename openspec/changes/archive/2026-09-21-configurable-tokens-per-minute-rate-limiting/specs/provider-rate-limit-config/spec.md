## ADDED Requirements

### Requirement: RateLimitSchema supports maxTokensMinute
The `RateLimitSchema` in `src/config/schemas/providers.js` SHALL include a `maxTokensMinute` field that accepts a non-negative integer value, with a default value of `0` (disabled).

#### Scenario: Default maxTokensMinute value
- **WHEN** a provider config is validated without `rateLimit.maxTokensMinute` specified
- **THEN** the schema defaults `maxTokensMinute` to `0`

#### Scenario: maxTokensMinute accepts zero
- **WHEN** a provider config specifies `rateLimit.maxTokensMinute: 0`
- **THEN** the schema accepts the value and validates successfully

#### Scenario: maxTokensMinute accepts positive values
- **WHEN** a provider config specifies `rateLimit.maxTokensMinute: 100000`
- **THEN** the schema accepts the value and validates successfully

#### Scenario: maxTokensMinute rejects negative values
- **WHEN** a provider config specifies `rateLimit.maxTokensMinute: -1`
- **THEN** the schema rejects the value with a validation error

#### Scenario: maxTokensMinute rejects non-integer values
- **WHEN** a provider config specifies `rateLimit.maxTokensMinute: 100.5`
- **THEN** the schema rejects the value with a validation error

### Requirement: createChatModel wires the token-budget throttle
The `createChatModel()` function in `src/provider/openai.js` SHALL, when `rateLimit.maxTokensMinute` is greater than `0`, estimate the request token cost (input tokens plus the `maxTokens` output budget), await `waitForCapacity(estimatedCost)`, then `consume(estimatedCost)` before invoking the model.

#### Scenario: throttle is wired when maxTokensMinute is positive
- **WHEN** a config includes `rateLimit.maxTokensMinute: 100000`
- **THEN** the returned ChatOpenAI instance dispatches requests through the token-budget throttle

#### Scenario: throttle is disabled when maxTokensMinute is zero
- **WHEN** a config has `rateLimit.maxTokensMinute: 0` or omits it
- **THEN** the returned ChatOpenAI instance does not apply token-budget throttling

### Requirement: createChatModel attributes 429 errors to an exceeded token budget
The `createChatModel()` function in `src/provider/openai.js` SHALL, when a `429` rate-limit error is caught and the rolling token window exceeds `maxTokensMinute`, log/flag the error as an exceeded token budget rather than an opaque provider error.

#### Scenario: 429 attributed to exceeded token budget
- **WHEN** a `429` error is caught and `current()` exceeds `maxTokensMinute`
- **THEN** the error is logged as an exceeded token budget

#### Scenario: 429 not attributed when budget not exceeded
- **WHEN** a `429` error is caught and `current()` does not exceed `maxTokensMinute`
- **THEN** the error is not attributed to an exceeded token budget
