# provider-rate-limit-config Specification

## Purpose
TBD - created by archiving change rate-limit-config-chatopenai. Update Purpose after archive.
## Requirements
### Requirement: RateLimitSchema supports maxRetries
The `RateLimitSchema` in `src/config/schemas/providers.js` SHALL include a `maxRetries` field that accepts an integer value between 0 and 10 inclusive, with a default value of 6.

#### Scenario: Default maxRetries value
- **WHEN** a provider config is validated without `rateLimit.maxRetries` specified
- **THEN** the schema defaults `maxRetries` to 6

#### Scenario: maxRetries accepts zero
- **WHEN** a provider config specifies `rateLimit.maxRetries: 0`
- **THEN** the schema accepts the value and validates successfully

#### Scenario: maxRetries accepts maximum value
- **WHEN** a provider config specifies `rateLimit.maxRetries: 10`
- **THEN** the schema accepts the value and validates successfully

#### Scenario: maxRetries rejects values below zero
- **WHEN** a provider config specifies `rateLimit.maxRetries: -1`
- **THEN** the schema rejects the value with a validation error

#### Scenario: maxRetries rejects values above ten
- **WHEN** a provider config specifies `rateLimit.maxRetries: 11`
- **THEN** the schema rejects the value with a validation error

### Requirement: RateLimitSchema supports maxConcurrency
The `RateLimitSchema` in `src/config/schemas/providers.js` SHALL include an optional `maxConcurrency` field that accepts an integer value of 1 or greater.

#### Scenario: maxConcurrency is optional
- **WHEN** a provider config is validated without `rateLimit.maxConcurrency` specified
- **THEN** the schema accepts the config without requiring the field

#### Scenario: maxConcurrency accepts minimum value
- **WHEN** a provider config specifies `rateLimit.maxConcurrency: 1`
- **THEN** the schema accepts the value and validates successfully

#### Scenario: maxConcurrency accepts high values
- **WHEN** a provider config specifies `rateLimit.maxConcurrency: 50`
- **THEN** the schema accepts the value and validates successfully

#### Scenario: maxConcurrency rejects zero
- **WHEN** a provider config specifies `rateLimit.maxConcurrency: 0`
- **THEN** the schema rejects the value with a validation error

#### Scenario: maxConcurrency rejects negative values
- **WHEN** a provider config specifies `rateLimit.maxConcurrency: -5`
- **THEN** the schema rejects the value with a validation error

### Requirement: createChatModel passes maxRetries to ChatOpenAI
The `createChatModel()` function in `src/provider/openai.js` SHALL pass the `maxRetries` value from the provider config to the `ChatOpenAI` constructor.

#### Scenario: maxRetries is passed when present
- **WHEN** a config includes `rateLimit.maxRetries: 3`
- **THEN** the returned ChatOpenAI instance receives `maxRetries: 3`

#### Scenario: default maxRetries is passed
- **WHEN** a config does not specify `rateLimit.maxRetries`
- **THEN** the returned ChatOpenAI instance receives the default value of 6

### Requirement: createChatModel passes maxConcurrency to ChatOpenAI
The `createChatModel()` function in `src/provider/openai.js` SHALL pass the `maxConcurrency` value from the provider config to the `ChatOpenAI` constructor when it is specified.

#### Scenario: maxConcurrency is passed when present
- **WHEN** a config includes `rateLimit.maxConcurrency: 5`
- **THEN** the returned ChatOpenAI instance receives `maxConcurrency: 5`

#### Scenario: maxConcurrency is omitted when not specified
- **WHEN** a config does not specify `rateLimit.maxConcurrency`
- **THEN** the returned ChatOpenAI instance does not receive a `maxConcurrency` parameter

### Requirement: JSDoc documents new parameters
The `createChatModel()` function JSDoc in `src/provider/openai.js` SHALL document the `rateLimit.maxRetries` and `rateLimit.maxConcurrency` configuration properties.

#### Scenario: JSDoc includes maxRetries
- **WHEN** reading the JSDoc of `createChatModel()`
- **THEN** it includes a `@property` entry for `rateLimit.maxRetries` describing the retry limit

#### Scenario: JSDoc includes maxConcurrency
- **WHEN** reading the JSDoc of `createChatModel()`
- **THEN** it includes a `@property` entry for `rateLimit.maxConcurrency` describing the concurrency limit

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

### Requirement: createChatModel returns a plain model instance
The `createChatModel()` function in `src/provider/openai.js` SHALL return a `ChatOpenAI` instance configured from
the provider config, and SHALL NOT install token-budget throttling by overriding instance methods. Budget
enforcement is the responsibility of the `TokenBudgetMiddleware` registered on the agent. The `createChatModel`
JSDoc SHALL state where enforcement lives.

#### Scenario: no instance-method override is installed
- **WHEN** `createChatModel` is called with `rateLimit.maxTokensMinute: 100000`
- **THEN** the returned instance's `invoke` and `stream` are the unmodified `ChatOpenAI` methods
- **AND** no `_rawInvoke` or `_rawStream` property is present on the instance

#### Scenario: budget enforcement is documented at the provider boundary
- **WHEN** reading the JSDoc of `createChatModel()`
- **THEN** it states that `maxTokensMinute` is enforced by `TokenBudgetMiddleware`, not by the model instance

### Requirement: maxConcurrency semantics are documented
The `createChatModel()` JSDoc in `src/provider/openai.js` SHALL document that `rateLimit.maxConcurrency` is
passed through to `ChatOpenAI` but is not used to gate concurrent model calls; actual concurrency comes from
parallel subagents, and the shared token budget is the enforcement point for the tokens-per-minute ceiling.

#### Scenario: JSDoc clarifies maxConcurrency
- **WHEN** reading the JSDoc of `createChatModel()`
- **THEN** the `rateLimit.maxConcurrency` entry states that it does not bound what the token budget sees and that
  the shared budget is the enforcement point

