# github-copilot-provider Specification

## Purpose
TBD - created by archiving change github-copilot-provider-oauth. Update Purpose after archive.
## Requirements
### Requirement: GitHub Copilot provider configuration
The system SHALL support a `github-copilot` provider type in the config schema that does not require a static `credentials.apiKey`. The `CopilotProviderConfigSchema` SHALL include an `enabled` boolean field defaulting to `true`.

#### Scenario: Valid Copilot provider config
- **WHEN** a config declares `providers.github-copilot` with a `model` and no `credentials.apiKey`
- **THEN** the config validates successfully

#### Scenario: Missing model
- **WHEN** a `github-copilot` provider is declared without a `model`
- **THEN** config validation fails with a clear error

#### Scenario: Default base URL
- **WHEN** a `github-copilot` provider is declared without a `base_url`
- **THEN** the base URL defaults to `https://api.githubcopilot.com`

#### Scenario: Copilot enabled defaults to true
- **WHEN** a `github-copilot` provider config is validated without an `enabled` field
- **THEN** the schema applies the default value of `true`

#### Scenario: Copilot can be disabled
- **WHEN** a `github-copilot` provider config sets `enabled: false`
- **THEN** the schema validates successfully and preserves `false`

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
The system SHALL inject `Authorization: Bearer <short-lived-token>` on every Copilot model request via a custom fetch interceptor, after exchanging the OAuth device-flow token for a short-lived API bearer at `copilot_internal/v2/token`.

#### Scenario: Fetch interceptor adds exchanged bearer token
- **WHEN** `createCopilotFetch()` is used to make a request
- **THEN** the request includes `Authorization: Bearer <short-lived-token>` (the exchanged bearer), read fresh from the exchange cache, not the raw OAuth token

#### Scenario: Model uses the interceptor
- **WHEN** a `github-copilot` provider is the active provider
- **THEN** `createChatModel` passes the custom fetch to `ChatOpenAI` and supplies a non-empty placeholder `apiKey` so the OpenAI SDK constructor's credential check passes, while the custom fetch interceptor injects the real exchanged bearer token

#### Scenario: Placeholder apiKey is not sent as Authorization header
- **WHEN** a `github-copilot` provider model is constructed with a custom fetch interceptor
- **THEN** the placeholder `apiKey` is never sent as the `Authorization` header; the custom fetch interceptor supplies `Authorization: Bearer <short-lived-token>`

#### Scenario: Model constructs without OPENAI_API_KEY
- **WHEN** `createChatModel` builds a `github-copilot` model with `OPENAI_API_KEY` unset in the environment
- **THEN** the client is constructed without throwing `Missing credentials`

### Requirement: Enterprise Copilot base URL derivation
The system SHALL derive the Copilot API base URL for enterprise/GHE deployments as `https://copilot-api.<domain>` (matching opencode), instead of `https://<domain>/api/v1`. When no enterprise URL is configured, the public default `https://api.githubcopilot.com` SHALL be used.

#### Scenario: Enterprise base URL uses copilot-api host
- **WHEN** `base()` is called with an enterprise URL such as `https://ghe.example.com/`
- **THEN** it returns `https://copilot-api.ghe.example.com`

#### Scenario: Public base URL unchanged
- **WHEN** `base()` is called with no enterprise URL
- **THEN** it returns `https://api.githubcopilot.com`

#### Scenario: createChatModel uses the enterprise base URL
- **WHEN** a `github-copilot` provider is configured with an `enterpriseUrl`
- **THEN** `createChatModel` sets the client `baseURL` to `https://copilot-api.<domain>`

### Requirement: Copilot model discovery
The system SHALL discover the tenant's available models for a `github-copilot` provider by fetching `GET {base}/models`, and SHALL resolve the configured `model` against the tenant's model list. If discovery fails (network error, non-200, model not found), the system SHALL fall back to the configured model string.

#### Scenario: Model discovered from tenant list
- **WHEN** `GET {base}/models` returns a list containing the configured model
- **THEN** the provider uses the resolved model

#### Scenario: Discovery failure falls back to configured model
- **WHEN** `GET {base}/models` fails or does not contain the configured model
- **THEN** the provider falls back to the configured model string

