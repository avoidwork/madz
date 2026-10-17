## ADDED Requirements

### Requirement: Copilot 403 retry middleware
The system SHALL retry GitHub Copilot 403 rate-limit responses via a `wrapModelCall` middleware, up to a maximum of 3 retries after the initial attempt, so that transient Copilot rate limits are handled transparently.

#### Scenario: Middleware is created
- **WHEN** `createCopilotRetryMiddleware` is called
- **THEN** it returns a middleware named `CopilotRetry` exposing a `wrapModelCall` function

#### Scenario: Retry on 403
- **WHEN** the wrapped model call throws an error with status 403
- **THEN** the middleware retries the call, up to `maxRetries` additional attempts

#### Scenario: Succeeds after retry
- **WHEN** a 403 is followed by a successful response within the retry budget
- **THEN** the middleware returns the successful result

#### Scenario: Exhausts retries
- **WHEN** the wrapped call throws 403 on every attempt
- **THEN** the middleware surfaces the final error after exhausting `maxRetries`

#### Scenario: Non-403 errors are not retried
- **WHEN** the wrapped call throws an error with a status other than 403 (e.g. 400)
- **THEN** the middleware rethrows immediately without retrying

#### Scenario: 429 is not retried by this middleware
- **WHEN** the wrapped call throws an error with status 429
- **THEN** the middleware rethrows immediately (the OpenAI SDK handles 429)

### Requirement: Copilot retry delay honors retry-after
The system SHALL honor the `retry-after` header when computing the delay between Copilot 403 retries, falling back to a default of 5 seconds when the header is absent.

#### Scenario: Retry-after header present
- **WHEN** a 403 error carries a `retry-after` header
- **THEN** the middleware waits the specified delay before retrying

#### Scenario: Retry-after header absent
- **WHEN** a 403 error carries no `retry-after` header
- **THEN** the middleware waits the default delay (5 seconds) before retrying

### Requirement: Copilot retry middleware is gated to Copilot connections
The system SHALL register the Copilot retry middleware in the agent middleware chain only when the active provider is `github-copilot`.

#### Scenario: Registered for Copilot
- **WHEN** the active provider type is `github-copilot`
- **THEN** the `CopilotRetry` middleware is included in the `createDeepAgent` middleware array

#### Scenario: Not registered for other providers
- **WHEN** the active provider type is not `github-copilot`
- **THEN** the `CopilotRetry` middleware is not included in the middleware array
