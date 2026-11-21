# poppy-api-integration Specification

## Purpose
Lets madz call a company's OpenAPI and MCP APIs with the Poppy-Session header and access tokens, selecting the right API for a task, enforcing scopes on company-side endpoints, and handling access token errors per Poppy spec section 7.

## Requirements

### Requirement: OpenAPI and MCP APIs are discovered and selected
The system SHALL discover `openapi` and `mcp` entries from a company's `poppy.json` and select the right API for a task by matching the task against the API's type and description.

#### Scenario: OpenAPI API is selected for a matching task
- **WHEN** a task matches an `openapi` API entry in `poppy.json`
- **THEN** the system selects that OpenAPI API for the call

#### Scenario: MCP API is selected for a matching task
- **WHEN** a task matches an `mcp` API entry in `poppy.json`
- **THEN** the system selects that MCP API for the call

#### Scenario: No matching API is reported
- **WHEN** no `openapi` or `mcp` entry in `poppy.json` matches the task
- **THEN** the system returns an error

#### Scenario: Unknown API type is reported
- **WHEN** an API entry in `poppy.json` has a type other than `openapi` or `mcp`
- **THEN** the system returns an error

### Requirement: OpenAPI endpoints are called with Poppy headers and access token
The system SHALL call an OpenAPI endpoint with the `Poppy-Session` header, `Poppy-Version`, `Poppy-Extensions`, and access token as needed, over HTTPS. The `Poppy-Extensions` header is an RFC 9651 List of Strings declaring each supported extension with one version.

#### Scenario: OpenAPI call includes session and version headers
- **WHEN** an OpenAPI endpoint is called with a session JWT and protocol version
- **THEN** the request includes the `Poppy-Session` and `Poppy-Version` headers

#### Scenario: OpenAPI call includes access token
- **WHEN** an access token is available for the OpenAPI call
- **THEN** the request includes the access token as a bearer token

#### Scenario: OpenAPI call includes extensions header
- **WHEN** extensions are configured for the OpenAPI call
- **THEN** the request includes the `Poppy-Extensions` header as an RFC 9651 List of Strings with one version per declared extension

#### Scenario: Non-HTTPS OpenAPI URL is rejected
- **WHEN** an OpenAPI endpoint URL is not HTTPS
- **THEN** the system returns an error

### Requirement: Remote MCP servers are called over Streamable HTTP transport
The system SHALL call a remote MCP server over Streamable HTTP transport (MCP protocol 2025-06-18 or later) with the session header, requesting a token with `resource` set to the MCP server's URL.

#### Scenario: MCP server is called with session header
- **WHEN** a remote MCP server is called
- **THEN** the request includes the `Poppy-Session` header

#### Scenario: Token is requested with the MCP server URL as resource
- **WHEN** a token is requested for an MCP server call
- **THEN** the token request sets `resource` to the MCP server's URL

### Requirement: Access token errors are mapped per section 7
The system SHALL map access token errors per Poppy spec section 7: `invalid_token` (401), `insufficient_scope` (403), `invalid_session` (400), `session_ended` (400), `version_unsupported` (400), `extension_required` (403).

#### Scenario: invalid_token maps to 401
- **WHEN** the API returns an `invalid_token` error
- **THEN** the system reports it with status 401

#### Scenario: insufficient_scope maps to 403
- **WHEN** the API returns an `insufficient_scope` error
- **THEN** the system reports it with status 403

#### Scenario: invalid_session maps to 400
- **WHEN** the API returns an `invalid_session` error
- **THEN** the system reports it with status 400

#### Scenario: session_ended maps to 400
- **WHEN** the API returns a `session_ended` error
- **THEN** the system reports it with status 400

#### Scenario: version_unsupported maps to 400
- **WHEN** the API returns a `version_unsupported` error
- **THEN** the system reports it with status 400

#### Scenario: extension_required maps to 403
- **WHEN** the API returns an `extension_required` error
- **THEN** the system reports it with status 403

### Requirement: Scopes are enforced on company-side API endpoints
The system SHALL enforce scopes on company-side API endpoints, returning `insufficient_scope` (403) when a required scope is not granted.

#### Scenario: Required scope is granted
- **WHEN** a company-side API request requires a scope that the session grants
- **THEN** the system permits the request

#### Scenario: Required scope is not granted
- **WHEN** a company-side API request requires a scope that the session does not grant
- **THEN** the system returns `insufficient_scope` (403)

### Requirement: Idempotency keys are supported for safe retries
The system SHALL support idempotency keys for safe retries of API calls.

#### Scenario: Idempotency key is sent when provided
- **WHEN** an idempotency key is provided for an API call
- **THEN** the request includes the idempotency key header

#### Scenario: No idempotency header when key is absent
- **WHEN** no idempotency key is provided for an API call
- **THEN** the request does not include an idempotency key header
