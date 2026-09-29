## MODIFIED Requirements

### Requirement: Network Access Control
The sandbox SHALL allow outbound network access only to URLs that match the allowlist defined in `config.yaml`. Schemes `file://`, `gopher://`, and `dict://` are always blocked. Hostnames that resolve to internal/private IP addresses SHALL be blocked, and allowlist matching SHALL compare the exact hostname (and port) rather than a URL prefix.

#### Scenario: Skill makes an allowed network request
- **WHEN** a skill performs an HTTP request to a URL in the allowlist
- **THEN** the system permits the request and returns the response to the skill

#### Scenario: Skill attempts a disallowed request
- **WHEN** a skill attempts to connect to a URL not on the allowlist or using a blocked scheme
- **THEN** the system aborts the request and logs a `NetworkViolation` event to telemetry

#### Scenario: Hostname resolving to a private IP is blocked
- **WHEN** a skill attempts to connect to a hostname that resolves to an internal/private IP address (e.g., a domain pointing at `169.254.169.254`)
- **THEN** the system blocks the request, even though the hostname is not a literal IP string

#### Scenario: Allowlist rejects prefix-match bypass
- **WHEN** a skill attempts to connect to `https://example.com.evil.com` while `https://example.com` is allowlisted
- **THEN** the system rejects the request because the hostname does not exactly match the allowlisted host
