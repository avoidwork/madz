# api Specification

## Purpose
TBD - created by archiving change structured-data-api-tools. Update Purpose after archive.
## Requirements
### Requirement: REST API client supports all HTTP methods
The system SHALL provide a REST API client that supports GET, POST, PUT, DELETE, and PATCH HTTP methods with configurable headers, body, and authentication.

#### Scenario: Successful GET request
- **WHEN** the user calls the api tool with method "GET" and a valid URL
- **THEN** the system returns the response body, status code, and headers

#### Scenario: Successful POST request with JSON body
- **WHEN** the user calls the api tool with method "POST", a valid URL, and a JSON body
- **THEN** the system sends the request with Content-Type: application/json and returns the response

#### Scenario: Bearer token authentication
- **WHEN** the user calls the api tool with auth type "bearer" and a token
- **THEN** the system adds an Authorization: Bearer <token> header to the request

#### Scenario: Basic authentication
- **WHEN** the user calls the api tool with auth type "basic", username, and password
- **THEN** the system adds an Authorization: Basic <base64-encoded-credentials> header to the request

#### Scenario: API key authentication
- **WHEN** the user calls the api tool with auth type "apikey", a key, and an optional header name
- **THEN** the system adds the API key to the specified header (default: X-API-Key)

#### Scenario: Request timeout
- **WHEN** the user calls the api tool with a timeout value and the request exceeds it
- **THEN** the system aborts the request and returns a timeout error

#### Scenario: URL scheme validation
- **WHEN** the user calls the api tool with a URL using file://, gopher://, or dict:// scheme
- **THEN** the system rejects the request with an error

### Requirement: REST API client validates URLs against allowlist
The system SHALL validate all outbound request URLs against a configurable allowlist before making requests.

#### Scenario: URL in allowlist is permitted
- **WHEN** the user calls the api tool with a URL that matches an entry in the allowlist
- **THEN** the system allows the request to proceed

#### Scenario: URL not in allowlist is rejected
- **WHEN** the user calls the api tool with a URL that does not match any entry in the allowlist
- **THEN** the system rejects the request with an error

#### Scenario: Internal IP addresses are blocked by default
- **WHEN** the user calls the api tool with a URL pointing to an internal IP (127.0.0.1, 0.0.0.0, 169.254.169.254)
- **THEN** the system rejects the request with an error

### Requirement: REST API client handles response sanitization
The system SHALL sanitize API responses by stripping sensitive headers and limiting response body size.

#### Scenario: Sensitive headers are stripped
- **WHEN** the system receives an API response with Set-Cookie or WWW-Authenticate headers
- **THEN** the system removes these headers from the returned response

#### Scenario: Response body size limit
- **WHEN** the system receives an API response exceeding the configured size limit (default: 10MB)
- **THEN** the system truncates the response and returns a size-limit error

### Requirement: GraphQL client supports queries and mutations
The system SHALL provide a GraphQL client that supports executing queries and mutations against GraphQL endpoints.

#### Scenario: Successful GraphQL query
- **WHEN** the user calls the api tool with a GraphQL query string
- **THEN** the system executes the query and returns the data and any errors

#### Scenario: GraphQL mutation with variables
- **WHEN** the user calls the api tool with a GraphQL mutation and variables
- **THEN** the system executes the mutation with the provided variables and returns the result

#### Scenario: GraphQL introspection
- **WHEN** the user calls the api tool with an introspection query
- **THEN** the system returns the schema introspection data

#### Scenario: GraphQL query depth limit
- **WHEN** the user calls the api tool with a GraphQL query exceeding the depth limit (default: 10)
- **THEN** the system rejects the query with a depth-limit error

#### Scenario: GraphQL complexity limit
- **WHEN** the user calls the api tool with a GraphQL query exceeding the complexity limit (default: 1000)
- **THEN** the system rejects the query with a complexity-limit error

### Requirement: REST API client supports configurable headers
The system SHALL allow the user to specify custom headers for all API requests.

#### Scenario: Custom headers are included
- **WHEN** the user calls the api tool with custom headers
- **THEN** the system includes all custom headers in the request

#### Scenario: Auth headers override custom headers
- **WHEN** the user specifies both auth configuration and a conflicting Authorization header
- **THEN** the auth configuration takes precedence

