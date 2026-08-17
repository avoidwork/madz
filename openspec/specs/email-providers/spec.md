# email-providers Specification

## Purpose
TBD - created by archiving change email-integration. Update Purpose after archive.
## Requirements
### Requirement: Provider abstraction interface
The system SHALL define an `EmailProvider` interface that all email providers implement, providing a unified API for email operations regardless of backend.

#### Scenario: Provider interface defines required methods
- **WHEN** a new provider is created
- **THEN** it MUST implement send(), read(), search(), draftSave(), draftList(), draftUpdate(), draftDelete(), and organize() methods

#### Scenario: Provider returns consistent message format
- **WHEN** any provider's read() or search() method is called
- **THEN** it returns messages in a standardized format with id, subject, from, to, date, body, isRead, labels, and folder fields

### Requirement: Gmail provider implementation
The system SHALL provide a Gmail provider using the Google Gmail API with OAuth2 authentication.

#### Scenario: Gmail provider authenticates via OAuth2
- **WHEN** Gmail provider is initialized with valid OAuth2 credentials
- **THEN** it obtains an access token and can make authenticated API requests

#### Scenario: Gmail provider sends email
- **WHEN** Gmail provider's send() method is called with valid message content
- **THEN** it sends the email via Gmail API and returns the message id

#### Scenario: Gmail provider reads inbox
- **WHEN** Gmail provider's read() method is called with folder="inbox"
- **THEN** it returns inbox messages via Gmail API's users.messages.list endpoint

#### Scenario: Gmail provider handles token refresh
- **WHEN** Gmail provider's access token expires during an operation
- **THEN** it automatically refreshes the token using the refresh token and retries the operation

### Requirement: MS Graph provider implementation
The system SHALL provide an MS Graph provider using the Microsoft Graph API with OAuth2 authentication.

#### Scenario: MS Graph provider authenticates via OAuth2
- **WHEN** MS Graph provider is initialized with valid OAuth2 credentials
- **THEN** it obtains an access token and can make authenticated Graph API requests

#### Scenario: MS Graph provider sends email
- **WHEN** MS Graph provider's send() method is called with valid message content
- **THEN** it sends the email via Microsoft Graph API and returns the message id

#### Scenario: MS Graph provider reads inbox
- **WHEN** MS Graph provider's read() method is called with folder="inbox"
- **THEN** it returns inbox messages via Microsoft Graph API's /me/messages endpoint

#### Scenario: MS Graph provider handles token refresh
- **WHEN** MS Graph provider's access token expires during an operation
- **THEN** it automatically refreshes the token using the refresh token and retries the operation

### Requirement: IMAP provider implementation
The system SHALL provide an IMAP provider as a universal fallback using username/password authentication.

#### Scenario: IMAP provider authenticates with credentials
- **WHEN** IMAP provider is initialized with valid host, port, username, and password
- **THEN** it establishes an IMAP connection and can execute IMAP commands

#### Scenario: IMAP provider sends email via SMTP
- **WHEN** IMAP provider's send() method is called with valid message content
- **THEN** it sends the email via SMTP and returns success

#### Scenario: IMAP provider reads inbox
- **WHEN** IMAP provider's read() method is called with folder="inbox"
- **THEN** it fetches messages via IMAP FETCH commands and returns them in the standard format

#### Scenario: IMAP provider handles connection errors
- **WHEN** IMAP provider cannot connect to the server
- **THEN** it throws a descriptive error with the connection failure details

### Requirement: Provider factory and selection
The system SHALL provide a factory that creates the appropriate provider instance based on configuration.

#### Scenario: Factory creates Gmail provider when configured
- **WHEN** config specifies provider="gmail" with OAuth2 credentials
- **THEN** factory returns a Gmail provider instance

#### Scenario: Factory creates MS Graph provider when configured
- **WHEN** config specifies provider="graph" with OAuth2 credentials
- **THEN** factory returns an MS Graph provider instance

#### Scenario: Factory creates IMAP provider when configured
- **WHEN** config specifies provider="imap" with host, port, username, and password
- **THEN** factory returns an IMAP provider instance

#### Scenario: Factory returns null when no provider configured
- **WHEN** no email provider is configured in config.yaml
- **THEN** factory returns null and email tools gracefully report "no provider configured"

