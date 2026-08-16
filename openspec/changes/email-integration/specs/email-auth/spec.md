## ADDED Requirements

### Requirement: OAuth2 credential storage
The system SHALL store OAuth2 access and refresh tokens in the memory system with encryption at rest.

#### Scenario: Store OAuth2 credentials securely
- **WHEN** OAuth2 tokens are obtained from a provider
- **THEN** they are encrypted and stored in the memory system under a provider-specific key

#### Scenario: Retrieve OAuth2 credentials
- **WHEN** a provider needs its tokens
- **THEN** the system decrypts and returns the stored tokens

#### Scenario: Rotate OAuth2 credentials
- **WHEN** a new refresh token is obtained during token refresh
- **THEN** the system updates the stored credentials atomically

#### Scenario: Clear OAuth2 credentials on logout
- **WHEN** the provider is disconnected or credentials are invalidated
- **THEN** the system removes the stored tokens from the memory system

### Requirement: IMAP credential storage
The system SHALL store IMAP credentials (host, port, username, password) in the memory system with encryption at rest.

#### Scenario: Store IMAP credentials securely
- **WHEN** IMAP credentials are configured
- **THEN** they are encrypted and stored in the memory system under a provider-specific key

#### Scenario: Retrieve IMAP credentials
- **WHEN** the IMAP provider needs credentials
- **THEN** the system decrypts and returns the stored credentials

#### Scenario: Never log IMAP credentials
- **WHEN** any operation involving IMAP credentials
- **THEN** credentials are never written to logs, error messages, or telemetry data

### Requirement: Credential validation at startup
The system SHALL validate email provider credentials during application startup.

#### Scenario: Validate Gmail OAuth2 credentials on startup
- **WHEN** the application starts with Gmail provider configured
- **THEN** it validates the OAuth2 credentials by making a test API request

#### Scenario: Validate IMAP credentials on startup
- **WHEN** the application starts with IMAP provider configured
- **THEN** it validates the credentials by attempting an IMAP connection

#### Scenario: Graceful degradation when credentials are invalid
- **WHEN** the application starts with invalid email credentials
- **THEN** it logs a warning and continues without email tools, rather than crashing

### Requirement: Credential configuration schema
The system SHALL define Zod validation schemas for email provider configurations.

#### Scenario: Validate Gmail provider config
- **WHEN** a Gmail provider config is provided
- **THEN** the schema validates clientId, clientSecret, refreshToken, and required scopes

#### Scenario: Validate MS Graph provider config
- **WHEN** an MS Graph provider config is provided
- **THEN** the schema validates clientId, clientSecret, refreshToken, tenantId, and required scopes

#### Scenario: Validate IMAP provider config
- **WHEN** an IMAP provider config is provided
- **THEN** the schema validates host, port, username, and password fields

#### Scenario: Reject incomplete provider config
- **WHEN** a provider config is missing required fields
- **THEN** the schema validation fails with a descriptive error listing missing fields