# webhook-management Specification

## Purpose
Provide webhook management capabilities for creating, listing, and deleting webhook endpoints with HMAC-SHA256 signature verification.

## Requirements

### Requirement: Webhook creation
The system SHALL create webhook endpoints that receive HTTP POST requests.

#### Scenario: Create webhook endpoint
- **WHEN** a webhook URL and secret are provided
- **THEN** the system registers the endpoint and returns a webhook ID

#### Scenario: Create webhook with custom headers
- **WHEN** custom headers are provided with the webhook
- **THEN** the system stores and includes them in outgoing requests

### Requirement: Webhook listing
The system SHALL list all registered webhook endpoints.

#### Scenario: List all webhooks
- **WHEN** the list webhooks action is called
- **THEN** the system returns an array of all registered webhooks (with secrets masked)

#### Scenario: List webhooks when none exist
- **WHEN** no webhooks are registered
- **THEN** the system returns an empty array

### Requirement: Webhook deletion
The system SHALL delete registered webhook endpoints.

#### Scenario: Delete existing webhook
- **WHEN** a valid webhook ID is provided
- **THEN** the system removes the webhook and returns success

#### Scenario: Delete non-existent webhook
- **WHEN** an invalid webhook ID is provided
- **THEN** the system returns an error

### Requirement: HMAC-SHA256 signature verification
The system SHALL verify incoming webhook signatures using HMAC-SHA256.

#### Scenario: Valid signature
- **WHEN** a webhook request with a valid HMAC-SHA256 signature is received
- **THEN** the system accepts the request and processes the payload

#### Scenario: Invalid signature
- **WHEN** a webhook request with an invalid HMAC-SHA256 signature is received
- **THEN** the system rejects the request with a 401 status

#### Scenario: Missing signature
- **WHEN** a webhook request without a signature header is received
- **THEN** the system rejects the request with a 401 status

#### Scenario: Expired signature
- **WHEN** a webhook request with a timestamp older than 5 minutes is received
- **THEN** the system rejects the request with a 401 status

### Requirement: Webhook delivery
The system SHALL deliver webhook payloads to registered endpoints.

#### Scenario: Successful delivery
- **WHEN** a webhook payload is delivered to a registered endpoint
- **THEN** the system returns the HTTP status code from the endpoint

#### Scenario: Failed delivery
- **WHEN** a webhook endpoint returns a non-2xx status
- **THEN** the system logs the failure and returns the status code

### Requirement: Rate limiting
The system SHALL rate-limit webhook deliveries.

#### Scenario: Default rate limit
- **WHEN** more than 100 webhook deliveries per minute are attempted
- **THEN** the system rejects excess deliveries with a rate limit error

#### Scenario: Custom rate limit
- **WHEN** a custom rate limit of 50/minute is specified
- **THEN** the system enforces the custom limit