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

