## ADDED Requirements

### Requirement: Copilot 403 rate-limit retry
The system SHALL retry GitHub Copilot 403 rate-limit responses for `github-copilot` provider connections, since Copilot signals rate limiting with HTTP 403 rather than 429.

#### Scenario: Copilot 403 is retried
- **WHEN** a `github-copilot` provider model call returns a 403 rate-limit error
- **THEN** the system retries the call up to 3 times before surfacing the error

#### Scenario: Non-Copilot providers are unaffected
- **WHEN** a non-`github-copilot` provider model call returns a 403
- **THEN** the system does not apply the Copilot 403 retry behavior
