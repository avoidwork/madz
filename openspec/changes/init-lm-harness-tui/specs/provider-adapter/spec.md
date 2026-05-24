## ADDED Requirements

### Requirement: Unified provider interface
The system SHALL expose a single adapter interface for all LLM providers with consistent methods for chat, completion, and streaming.

#### Scenario: Provider interface defines methods
- **WHEN** a provider adapter is implemented
- **THEN** it must implement `chat(input)`, `complete(input)`, and `stream(input)` methods returning normalized response objects

#### Scenario: Response normalization
- **WHEN** any provider method returns a response
- **THEN** the response is normalized to a consistent format including `content`, `model`, `tokens`, `latencyMs`, and `stopReason`

### Requirement: OpenAI provider support
The system SHALL support OpenAI API-compatible endpoints (including API.com and compatible services) with API key authentication.

#### Scenario: OpenAI chat completion
- **WHEN** a user message is sent with the OpenAI provider selected
- **THEN** the system sends a request to the configured OpenAI-compatible API endpoint and returns the response

#### Scenario: OpenAI streaming support
- **WHEN** a user message is sent with streaming enabled on an OpenAI provider
- **THEN** the system uses SSE to receive incremental token streams and forwards them to the TUI

### Requirement: Local model provider support
The system SHALL support local model deployments accessible via standard REST or WebSocket interfaces.

#### Scenario: Local model inference
- **WHEN** a user message is sent with a local model provider selected
- **THEN** the system sends a request to the configured base URL using the local model's API format

#### Scenario: WebSocket streaming for local models
- **WHEN** a local provider supports WebSocket streaming
- **THEN** the system establishes a WebSocket connection and forwards incremental output to the TUI

### Requirement: Provider selection and fallback
The system SHALL support selecting an active provider from configuration and implementing a fallback chain when the primary provider fails.

#### Scenario: Active provider from config
- **WHEN** the user or TUI sets an active provider via `/provider <name>`
- **THEN** the system switches the adapter factory to use the specified provider

#### Scenario: Fallback primary failure
- **WHEN** the configured provider fails (timeout, rate limit, auth error)
- **THEN** the system attempts the next provider in the fallback chain defined in `config.yaml`

#### Scenario: All fallbacks exhausted
- **WHEN** all providers in the fallback chain fail
- **THEN** the system returns an error to the user with the list of failed providers and a summary of errors

### Requirement: Rate limiting per provider
The system SHALL enforce configurable rate limits per provider as defined in `config.yaml`.

#### Scenario: Rate limit enforced
- **WHEN** requests to a provider exceed the configured rate limit
- **THEN** the system queues requests and processes them at the allowed rate from an internal queue

#### Scenario: Rate limit configurable
- **WHEN** a provider entry in `config.yaml` includes `rateLimit.requestsPerMinute`
- **THEN** the adapter reads and enforces the specified rate limit automatically
