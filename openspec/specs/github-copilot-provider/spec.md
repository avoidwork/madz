# github-copilot-provider Specification

## Purpose
TBD - created by archiving change github-copilot-provider-oauth. Update Purpose after archive.
## Requirements
### Requirement: GitHub Copilot provider configuration
The system SHALL support a `github-copilot` provider type in the config schema that does not require a static `credentials.apiKey`.

#### Scenario: Valid Copilot provider config
- **WHEN** a config declares `providers.github-copilot` with a `model` and no `credentials.apiKey`
- **THEN** the config validates successfully

#### Scenario: Missing model
- **WHEN** a `github-copilot` provider is declared without a `model`
- **THEN** config validation fails with a clear error

#### Scenario: Default base URL
- **WHEN** a `github-copilot` provider is declared without a `base_url`
- **THEN** the base URL defaults to `https://api.githubcopilot.com`

### Requirement: OAuth device flow authorization
The system SHALL implement the OAuth 2.0 Device Authorization Grant (RFC 8628) to obtain a Copilot access token.

#### Scenario: Initiate device flow
- **WHEN** `requestDeviceCode()` is called with `deploymentType: "github.com"`
- **THEN** it POSTs to `https://github.com/login/device/code` with `client_id` and `scope: "read:user"` and returns a verification URL and user code

#### Scenario: Poll for token
- **WHEN** the polling loop receives `authorization_pending`
- **THEN** it waits the device interval plus a safety margin and polls again

#### Scenario: Slow down handling
- **WHEN** the polling loop receives `slow_down`
- **THEN** it waits the server-provided interval (or the device interval plus 5 seconds) plus a safety margin and polls again

#### Scenario: Successful authorization
- **WHEN** the polling loop receives an `access_token`
- **THEN** it persists the token and returns success

#### Scenario: Failed authorization
- **WHEN** the polling loop receives an error other than `authorization_pending` or `slow_down`
- **THEN** it returns a failure result

### Requirement: Token persistence and retrieval
The system SHALL persist the Copilot token to `memory/auth.json` with mode `0o600` and retrieve it via `getToken()`.

#### Scenario: Persist token
- **WHEN** the device flow obtains an access token
- **THEN** it writes the token to `memory/auth.json` with mode `0o600`

#### Scenario: Retrieve token
- **WHEN** `getToken()` is called after a successful authorization
- **THEN** it returns the stored token

#### Scenario: Missing token file
- **WHEN** `getToken()` is called with no token file present
- **THEN** it surfaces a clear re-auth prompt

### Requirement: Bearer token injection on model requests
The system SHALL inject `Authorization: Bearer <token>` on every Copilot model request via a custom fetch interceptor.

#### Scenario: Fetch interceptor adds bearer token
- **WHEN** `createCopilotFetch()` is used to make a request
- **THEN** the request includes `Authorization: Bearer <token>` read fresh from the auth file

#### Scenario: Model uses the interceptor
- **WHEN** a `github-copilot` provider is the active provider
- **THEN** `createChatModel` passes the custom fetch to `ChatOpenAI` and omits `apiKey`



