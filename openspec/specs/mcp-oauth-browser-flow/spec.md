# mcp-oauth-browser-flow Specification

## Purpose

Provides a browser-based OAuth2 authorization-code + PKCE flow for MCP servers that bridges a containerized madz process to a host OS browser, so the user can complete authorization in their browser and the container can capture the resulting code.

## Requirements

### Requirement: Callback server captures authorization code

The system SHALL run an ephemeral HTTP callback server bound to localhost that captures the `code` and `state` parameters from an OAuth2 authorization redirect and stores them in a response store.

#### Scenario: Redirect with valid code and state

- **WHEN** the authorization server redirects the browser to the callback server with a `code` and `state`
- **THEN** the callback server stores the code and state in the response store

#### Scenario: Redirect with missing code

- **WHEN** the authorization server redirects to the callback server without a `code` parameter
- **THEN** the callback server records the failure and does not store a code

### Requirement: Callback server validates state

The system SHALL validate the `state` parameter received by the callback server against the value the provider generated, and reject the redirect when they do not match.

#### Scenario: State mismatch rejected

- **WHEN** the callback server receives a `state` that does not match the value the provider generated
- **THEN** the callback server rejects the redirect and does not store the code

#### Scenario: State match accepted

- **WHEN** the callback server receives a `state` that matches the value the provider generated
- **THEN** the callback server accepts the redirect and stores the code

### Requirement: Callback server enforces a timeout

The system SHALL enforce a timeout on the callback port so the flow does not wait indefinitely for a redirect.

#### Scenario: Callback times out

- **WHEN** no redirect arrives within the configured timeout
- **THEN** the callback server records a timeout and the flow can proceed to a failure signal

### Requirement: Authorization URL surfaced via interrupt bridge

The system SHALL surface the authorization URL to the user through a clarification interrupt so the agent pauses until the browser flow completes.

#### Scenario: Authorization URL presented

- **WHEN** the provider initiates the browser flow
- **THEN** the authorization URL is surfaced to the user via a clarification prompt

### Requirement: Silent poller resumes the graph

The system SHALL run a background poller that watches the response store and resumes the agent graph with the captured code when it arrives, without requiring user keystrokes.

#### Scenario: Code arrives and graph resumes

- **WHEN** the callback server stores a code in the response store
- **THEN** the poller resumes the graph with the code as the resume value

#### Scenario: Poller gives up on timeout

- **WHEN** no code arrives within the poller's timeout
- **THEN** the poller resumes the graph with a failure signal so the agent does not hang

### Requirement: Authorization code exchange

The system SHALL exchange the captured authorization code for tokens using the PKCE code verifier and the callback redirect URI.

#### Scenario: Code exchanged for tokens

- **WHEN** the provider has a captured authorization code and code verifier
- **THEN** the provider exchanges the code for tokens at the token endpoint
