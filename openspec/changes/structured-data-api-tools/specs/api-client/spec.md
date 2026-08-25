## ADDED Requirements

### Requirement: REST client executes authenticated HTTP requests
The REST API client SHALL support GET, POST, PUT, DELETE, and PATCH methods with configurable headers, body, and authentication.

#### Scenario: Successful GET request
- **WHEN** the user calls the REST tool with method "GET" and a valid URL
- **THEN** the tool returns the response body, status code, and headers

#### Scenario: POST request with JSON body
- **WHEN** the user calls the REST tool with method "POST", a URL, and a JSON body
- **THEN** the tool sends the request with Content-Type: application/json and returns the response

#### Scenario: Bearer token authentication
- **WHEN** the user provides auth.type "bearer" with a token
- **THEN** the tool adds an Authorization: Bearer <token> header to the request

#### Scenario: Basic authentication
- **WHEN** the user provides auth.type "basic" with a token
- **THEN** the tool adds an Authorization: Basic <base64(token)> header to the request

#### Scenario: API Key authentication
- **WHEN** the user provides auth.type "apikey" with a key and optional token
- **THEN** the tool adds the API key header as configured

### Requirement: REST client enforces URL allowlist
The REST API client SHALL validate all request URLs against an allowlist before making outbound requests.

#### Scenario: URL on allowlist succeeds
- **WHEN** the request URL matches an entry in the allowlist
- **THEN** the request proceeds normally

#### Scenario: URL not on allowlist is rejected
- **WHEN** the request URL does not match any entry in the allowlist
- **THEN** the tool returns an error and does not make the request

#### Scenario: Disallowed schemes are rejected
- **WHEN** the request URL uses file://, gopher://, or dict:// scheme
- **THEN** the tool returns an error regardless of allowlist

#### Scenario: Internal IP addresses are rejected
- **WHEN** the request URL resolves to an internal IP (127.0.0.1, 0.0.0.0, 169.254.169.254)
- **THEN** the tool returns an error unless explicitly allowed

### Requirement: REST client supports configurable timeouts
The REST API client SHALL support configurable request timeouts with a default of 30 seconds.

#### Scenario: Default timeout applies
- **WHEN** no timeout is specified
- **THEN** the request uses a 30-second default timeout

#### Scenario: Custom timeout is respected
- **WHEN** the user specifies a timeout of 5000 milliseconds
- **THEN** the request times out after 5 seconds if not completed

### Requirement: REST client sanitizes responses
The REST API client SHALL strip sensitive headers from proxied responses.

#### Scenario: Sensitive headers are stripped
- **WHEN** the response includes Set-Cookie or WWW-Authenticate headers
- **THEN** the tool removes these headers from the returned response

### Requirement: REST client limits response size
The REST API client SHALL limit response body size to prevent memory exhaustion.

#### Scenario: Response within limit is returned
- **WHEN** the response body is within the 10MB limit
- **THEN** the full response body is returned

#### Scenario: Response exceeding limit is rejected
- **WHEN** the response body exceeds 10MB
- **THEN** the tool returns an error with a size-exceeded message
