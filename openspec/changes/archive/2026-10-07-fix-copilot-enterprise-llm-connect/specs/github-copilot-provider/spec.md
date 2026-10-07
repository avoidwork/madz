## ADDED Requirements

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
