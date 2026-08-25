# webhook Specification

## Purpose
TBD - created by archiving change structured-data-api-tools. Update Purpose after archive.
## Requirements
### Requirement: Webhook management supports CRUD operations
The system SHALL provide webhook management capabilities including create, list, and delete operations.

#### Scenario: Create webhook endpoint
- **WHEN** the user calls the webhook tool with action "create", a URL, and optional events
- **THEN** the system registers the webhook endpoint and returns the created webhook ID

#### Scenario: List registered webhooks
- **WHEN** the user calls the webhook tool with action "list"
- **THEN** the system returns all registered webhook endpoints with their configurations

#### Scenario: Delete webhook endpoint
- **WHEN** the user calls the webhook tool with action "delete" and a webhook ID
- **THEN** the system removes the webhook endpoint and confirms deletion

#### Scenario: Create webhook with secret
- **WHEN** the user calls the webhook tool with action "create", a URL, and a secret
- **THEN** the system stores the secret securely and uses it for HMAC-SHA256 signature generation

### Requirement: Webhook payload validation uses HMAC-SHA256
The system SHALL verify incoming webhook payloads using HMAC-SHA256 signature verification.

#### Scenario: Valid HMAC signature is accepted
- **WHEN** the system receives a webhook request with a valid HMAC-SHA256 signature
- **THEN** the system accepts the payload and processes it

#### Scenario: Invalid HMAC signature is rejected
- **WHEN** the system receives a webhook request with an invalid HMAC-SHA256 signature
- **THEN** the system rejects the request with a 401 status

#### Scenario: Missing signature is rejected
- **WHEN** the system receives a webhook request without an X-Webhook-Signature header
- **THEN** the system rejects the request with a 401 status

#### Scenario: Expired signature is rejected
- **WHEN** the system receives a webhook request with a signature older than the configured window (default: 5 minutes)
- **THEN** the system rejects the request with a 401 status

### Requirement: Webhook rate limiting
The system SHALL enforce rate limiting on webhook endpoints to prevent abuse.

#### Scenario: Rate limit is enforced
- **WHEN** more than the configured number of requests (default: 100) arrive per minute from a single source IP
- **THEN** the system rejects excess requests with a 429 status

#### Scenario: Rate limit resets after window
- **WHEN** the rate limit window expires (60 seconds)
- **THEN** the system resets the counter for the source IP

