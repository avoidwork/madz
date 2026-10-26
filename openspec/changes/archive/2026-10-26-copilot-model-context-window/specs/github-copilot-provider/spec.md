## MODIFIED Requirements

### Requirement: Copilot model discovery
The system SHALL discover the tenant's available models for a `github-copilot` provider by fetching `GET {base}/models`, and SHALL resolve the configured `model` against the tenant's model list. The discovery request SHALL be authenticated with the Copilot bearer token, reusing the same fetch interceptor (`createCopilotFetch`) used for model calls so the token is read fresh from `memory/auth.json` and 401 re-auth is handled consistently. If discovery fails (network error, non-200, model not found), the system SHALL fall back to the configured model string.

#### Scenario: Model discovered from tenant list
- **WHEN** `GET {base}/models` returns a list containing the configured model
- **THEN** the provider uses the resolved model

#### Scenario: Discovery request is authenticated
- **WHEN** `resolveCopilotModel` fetches `GET {base}/models`
- **THEN** the request carries `Authorization: Bearer <token>` via the Copilot fetch interceptor

#### Scenario: Discovery failure falls back to configured model
- **WHEN** `GET {base}/models` fails or does not contain the configured model
- **THEN** the provider falls back to the configured model string
