# Spec Delta

## ADDED Requirements

### Requirement: Configurable API mode for Cloud and Data Center
The system SHALL support a configurable `confluence.api` mode (`cloud` or `dc`) that selects the API path prefix and request/response shapes, defaulting to `cloud`. In `dc` mode the system SHALL target the Data Center REST v1 API (`/rest/api/...`) and use its request/response shapes.

#### Scenario: Cloud mode uses the v2 API path
- **WHEN** `confluence.api` is `cloud` (or unset)
- **THEN** the system targets the Cloud REST v2 API at `/wiki/api/v2/...`

#### Scenario: DC mode uses the v1 API path
- **WHEN** `confluence.api` is `dc`
- **THEN** the system targets the Data Center REST v1 API at `/rest/api/...`

### Requirement: Reject non-JSON responses on JSON API calls
The system SHALL treat a successful (2xx) response whose `content-type` is not JSON as a failure on a JSON API call, returning a diagnostic rather than a silent success.

#### Scenario: HTML response is rejected
- **WHEN** a JSON API call returns 200 with an HTML body (e.g. a login page)
- **THEN** the system returns `ok: false` with a diagnostic indicating the response was not JSON

### Requirement: Detect login redirects
The system SHALL detect responses that redirect to a login page (a redirect target containing `/login.action` or `permissionViolation`) and fail fast with an authentication/endpoint diagnostic rather than following the redirect.

#### Scenario: Login redirect is detected
- **WHEN** a request is redirected to a path containing `/login.action` or `permissionViolation`
- **THEN** the system returns `ok: false` with a diagnostic indicating authentication was rejected or the endpoint was not found

### Requirement: Correct search endpoint per mode
The system SHALL use the correct search endpoint for the configured mode: the v2 search endpoint in `cloud` mode and the v1 search endpoint (`/rest/api/search`) in `dc` mode.

#### Scenario: DC mode searches via the v1 search endpoint
- **WHEN** `confluence.api` is `dc` and a search is requested
- **THEN** the system queries the v1 search endpoint with the CQL

#### Scenario: Cloud mode searches via the v2 search endpoint
- **WHEN** `confluence.api` is `cloud` and a search is requested
- **THEN** the system queries the v2 search endpoint with the CQL
