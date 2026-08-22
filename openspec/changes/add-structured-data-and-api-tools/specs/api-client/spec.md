# api-client Specification

## Purpose
Provide a secure REST API client tool for making authenticated HTTP requests to external services.

## Requirements

### Requirement: HTTP method support
The system SHALL support GET, POST, PUT, DELETE, and PATCH HTTP methods.

#### Scenario: Execute GET request
- **WHEN** a GET request is made with a valid URL
- **THEN** the system returns the response body and status code

#### Scenario: Execute POST request with body
- **WHEN** a POST request is made with a JSON body
- **THEN** the system sends the body with Content-Type: application/json header

#### Scenario: Execute PUT request
- **WHEN** a PUT request is made with a JSON body
- **THEN** the system sends the body and returns the response

#### Scenario: Execute DELETE request
- **WHEN** a DELETE request is made
- **THEN** the system returns the response status and body

#### Scenario: Execute PATCH request
- **WHEN** a PATCH request is made with a JSON body
- **THEN** the system sends the partial update body

### Requirement: Authentication support
The system SHALL support Bearer token, Basic authentication, and API Key authentication.

#### Scenario: Bearer token authentication
- **WHEN** auth.type is "bearer" and a token is provided
- **THEN** the system adds Authorization: Bearer <token> header

#### Scenario: Basic authentication
- **WHEN** auth.type is "basic" and username/password are provided
- **THEN** the system adds Authorization: Basic <base64(username:password)> header

#### Scenario: API Key authentication
- **WHEN** auth.type is "apikey" and a key is provided
- **THEN** the system adds the API key header (configurable header name, default: X-API-Key)

### Requirement: URL validation
The system SHALL validate all outbound URLs against an allowlist.

#### Scenario: Allow valid URL
- **WHEN** a URL with http:// or https:// scheme is provided
- **THEN** the request proceeds

#### Scenario: Block file:// scheme
- **WHEN** a URL with file:// scheme is provided
- **THEN** the system rejects the request with an error

#### Scenario: Block gopher:// scheme
- **WHEN** a URL with gopher:// scheme is provided
- **THEN** the system rejects the request with an error

#### Scenario: Block dict:// scheme
- **WHEN** a URL with dict:// scheme is provided
- **THEN** the system rejects the request with an error

#### Scenario: Block internal IP addresses
- **WHEN** a URL resolves to an internal IP (127.0.0.1, 0.0.0.0, 169.254.169.254)
- **THEN** the system rejects the request with an error unless explicitly allowed

#### Scenario: Block sensitive header exposure
- **WHEN** a response includes Set-Cookie or WWW-Authenticate headers
- **THEN** the system strips these headers from the returned response

### Requirement: Client-side rate limiting
The system SHALL implement client-side rate limiting to avoid triggering provider blocks.

#### Scenario: Default rate limit
- **WHEN** more than 10 requests per second are made
- **THEN** the system queues excess requests and processes them at the allowed rate

#### Scenario: Custom rate limit
- **WHEN** a custom rate limit of 5 requests/second is specified
- **THEN** the system enforces the custom limit

### Requirement: Timeout support
The system SHALL support configurable request timeouts.

#### Scenario: Default timeout
- **WHEN** no timeout is specified
- **THEN** the system uses a 30-second default timeout

#### Scenario: Custom timeout
- **WHEN** a timeout of 5000ms is specified
- **THEN** the system aborts the request after 5 seconds if not complete

### Requirement: Response size limit
The system SHALL limit response body size to prevent memory exhaustion.

#### Scenario: Default response size limit
- **WHEN** response body exceeds 10MB
- **THEN** the system truncates and returns a size limit error

#### Scenario: Custom response size limit
- **WHEN** a custom maxResponseSize is specified
- **THEN** the system enforces the custom limit

### Requirement: Structured error handling
The system SHALL return structured error objects.

#### Scenario: HTTP error response
- **WHEN** the server returns a 4xx or 5xx status
- **THEN** the system returns { status, statusText, body, error: true }

#### Scenario: Network error
- **WHEN** the network request fails
- **THEN** the system returns { error: true, message: "<network error>" }

#### Scenario: Timeout error
- **WHEN** the request times out
- **THEN** the system returns { error: true, message: "Request timed out" }