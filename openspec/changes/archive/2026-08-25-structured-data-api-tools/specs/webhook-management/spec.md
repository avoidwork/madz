## ADDED Requirements

### Requirement: Webhook tool creates webhook registrations
The webhook management tool SHALL create webhook endpoint registrations with payload validation.

#### Scenario: Webhook registration created
- **WHEN** the user provides a URL and optional secret with action "create"
- **THEN** the tool stores the webhook registration and returns the registration ID

#### Scenario: Webhook with events specified
- **WHEN** the user provides specific event types for the webhook
- **THEN** the tool stores the event filter alongside the registration

### Requirement: Webhook tool lists registered webhooks
The webhook management tool SHALL list all registered webhook endpoints.

#### Scenario: Webhook list returned
- **WHEN** the user calls the webhook tool with action "list"
- **THEN** the tool returns an array of all registered webhooks with their URLs and events

### Requirement: Webhook tool deletes webhook registrations
The webhook management tool SHALL remove webhook endpoint registrations.

#### Scenario: Webhook deleted by ID
- **WHEN** the user provides a registration ID with action "delete"
- **THEN** the tool removes the registration and confirms deletion

#### Scenario: Delete nonexistent webhook
- **WHEN** the user provides an ID that does not exist
- **THEN** the tool returns an error indicating the webhook was not found

### Requirement: Webhook tool verifies HMAC signatures
The webhook management tool SHALL verify incoming webhook payloads using HMAC-SHA256 signatures.

#### Scenario: Valid HMAC signature verified
- **WHEN** the user provides a payload, signature, and matching secret with action "verify"
- **THEN** the tool returns success indicating the signature is valid

#### Scenario: Invalid HMAC signature rejected
- **WHEN** the user provides a payload, signature, and secret where the signature does not match
- **THEN** the tool returns an error indicating the signature is invalid

#### Scenario: Missing signature rejected
- **WHEN** the user provides a payload without a signature
- **THEN** the tool returns an error indicating the signature is required

### Requirement: Webhook registrations are persisted
The webhook management tool SHALL persist webhook registrations to a data file.

#### Scenario: Registrations persist across calls
- **WHEN** webhooks are created and the tool is called again
- **THEN** the previously created webhooks are still listed

#### Scenario: Registrations file is created
- **WHEN** the first webhook is created
- **THEN** the data/webhooks.json file is created with the registration data
