## MODIFIED Requirements

### Requirement: Exchange OAuth token for short-lived bearer
The system SHALL exchange the OAuth device-flow token for a short-lived API bearer by calling `GET https://api.githubcopilot.com/copilot_internal/v2/token` with `Authorization: token <oauthToken>`. When the exchange endpoint returns 404/unsupported (as on enterprise/GHE deployments), the system SHALL fall back to returning the OAuth token itself as the bearer, rather than throwing.

#### Scenario: Successful exchange
- **WHEN** `exchangeCopilotToken()` is called with a valid OAuth token
- **THEN** it requests `https://api.githubcopilot.com/copilot_internal/v2/token` with `Authorization: token <oauthToken>` and returns the short-lived bearer plus `expires_at`

#### Scenario: Exchange failure
- **WHEN** the exchange endpoint returns a non-ok response other than 404/unsupported
- **THEN** `exchangeCopilotToken()` throws an error

#### Scenario: 404 on exchange falls back to OAuth token
- **WHEN** the exchange endpoint returns 404 (unsupported on enterprise)
- **THEN** `exchangeCopilotToken()` returns the OAuth token itself as the bearer, without throwing
