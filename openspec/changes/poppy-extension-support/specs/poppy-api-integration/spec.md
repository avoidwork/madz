# Spec Delta

## MODIFIED Requirements

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
