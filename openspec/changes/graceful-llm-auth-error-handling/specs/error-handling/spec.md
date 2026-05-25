## ADDED Requirements

### Requirement: Error Class Hierarchy
The system SHALL define a structured error class hierarchy with an `AppError` base class and domain-specific subclasses (`AuthError`, `RateLimitError`, `TimeoutError`, `NetworkError`) for classifying LLM provider failures. Each error class MUST include a machine-readable `code` property and an HTTP `status` code.

#### Scenario: AppError carries code and status
- **WHEN** an `AppError` is instantiated with `message="connection failed"` and `code="network_error"` and `status=503`
- **THEN** the error has `appError.message === "connection failed"`, `appError.code === "network_error"`, and `appError.status === 503`

#### Scenario: AuthError is a subclass of AppError
- **WHEN** an `AuthError` is created with `message="Incorrect API key"` and `code="invalid_api_key"` and `status=401`
- **THEN** `authError instanceof AuthError` is `true` AND `authError instanceof AppError` is `true`

#### Scenario: NetworkError is a subclass of AppError
- **WHEN** a `NetworkError` is created with `message="connection refused"` and `code="network_error"` and `status=503`
- **THEN** `networkError instanceof NetworkError` is `true` AND `networkError instanceof AppError` is `true`

### Requirement: Error Classification
The system SHALL classify LLM provider errors using a `classifyError(err)` function that inspects error properties and returns an appropriately typed `AppError` subclass instance. Classification MUST be checked in priority order.

#### Scenario: Classification of invalid API key error
- **WHEN** `err.code === "invalid_api_key"` or `err.lc_error_code === "MODEL_AUTHENTICATION"`
- **THEN** the system returns an `AuthError` instance with the original error message

#### Scenario: Classification of rate limit error
- **WHEN** `err.status === 429` or `err.statusCode === 429`
- **THEN** the system returns a `RateLimitError` instance with the original error message

#### Scenario: Classification of timeout/network error
- **WHEN** the error code is `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`, or the error message matches "timed out"
- **THEN** the system returns a `TimeoutError` instance with the original error message

#### Scenario: Classification of unknown error
- **WHEN** the error does not match any known error pattern
- **THEN** the system returns an `AppError` instance wrapping the original error message

#### Scenario: Auth error takes priority over status code
- **WHEN** an error has both `err.code === "invalid_api_key"` and `err.status === 401`
- **THEN** the system returns an `AuthError` (not a generic `AppError`)

### Requirement: Auth Errors Skip Provider Fallback
The system SHALL skip remaining providers in the fallback chain when an `AuthError` is encountered, re-throwing immediately with a logged message.

#### Scenario: Auth error on first provider skips fallback
- **WHEN** `callProvider` on the first provider in the fallback chain throws an `AuthError`
- **THEN** `dispatchProvider` re-throws the error immediately without attempting subsequent providers

#### Scenario: Non-auth error on first provider tries fallback
- **WHEN** `callProvider` on the first provider throws a `RateLimitError` or `TimeoutError`
- **THEN** `dispatchProvider` continues to attempt the next provider in the fallback chain

#### Scenario: All providers fail with auth errors
- **WHEN** every provider in the fallback chain throws an `AuthError`
- **THEN** `dispatchProvider` throws an error containing the last provider's `AuthError` message

### Requirement: Graceful TUI Error Display
The system SHALL display classified LLM errors in the TUI with a descriptive message including the error type and human-readable information, displayed as a "system" role message with a red status indicator.

#### Scenario: Auth error displays structured message in TUI
- **WHEN** `dispatchProvider` throws an `AuthError` during a TUI chat session
- **THEN** the TUI adds a "system" role message containing the error code and a user-friendly description (e.g., "Authentication failed: Invalid API key")

#### Scenario: Rate limit error displays structured message in TUI
- **WHEN** `dispatchProvider` throws a `RateLimitError` during a TUI chat session
- **THEN** the TUI adds a "system" role message indicating the request was rate-limited

#### Scenario: Error displays red status indicator
- **WHEN** an error is displayed in the TUI
- **THEN** the status bar shows a red indicator (prefixed with "Error")

#### Scenario: TUI does not crash on error
- **WHEN** `dispatchProvider` throws any error during a TUI chat session
- **THEN** the TUI catches the error, displays it to the user, and remains responsive for subsequent messages

### Requirement: CLI Mode Error Display
The system SHALL display classified LLM errors in CLI chat mode with a structured error message.

#### Scenario: Auth error in CLI mode displays error message
- **WHEN** `handleConversation` throws an `AuthError` in CLI chat mode
- **THEN** the system prints `Error: [code] - [message]` to stderr and exits with code 1

### Requirement: Error Logging
The system SHALL log classified errors at the error level with the provider name, error code, and status for observability.

#### Scenario: Error is logged with provider context
- **WHEN** an error occurs during provider dispatch
- **THEN** the system logs a structured error message containing the provider name, error code, and error message

### Requirement: Agent Interruption Errors Pass Through
The system SHALL allow agent interruption errors (user interrupt) to pass through without classification or wrapping.

#### Scenario: User interrupt passes through unmodified
- **WHEN** the LangGraph agent throws an error with `interruptedReason` matching "User interrupted"
- **THEN** the error is re-thrown as-is without classification
