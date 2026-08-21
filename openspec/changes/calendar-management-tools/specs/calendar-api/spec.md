## ADDED Requirements

### Requirement: The system SHALL provide a unified calendar provider interface
The calendar tool SHALL expose a common `CalendarProvider` interface that abstracts provider-specific differences. Both Google Calendar and MS Graph implementations MUST conform to this interface.

#### Scenario: Provider interface defines required methods
- **WHEN** a calendar provider is instantiated
- **THEN** it MUST implement `listEvents`, `createEvent`, `updateEvent`, `deleteEvent`, `checkAvailability`, and `getCredentials` methods

#### Scenario: Provider selection via configuration
- **WHEN** the system loads calendar configuration from `config.yaml`
- **THEN** it SHALL instantiate the provider specified by the `provider` field (`google` or `microsoft`)

#### Scenario: Unknown provider configuration
- **WHEN** an unrecognized provider value is specified in configuration
- **THEN** the system SHALL throw a `CalendarProviderError` with a descriptive message

### Requirement: The system SHALL support Google Calendar as a provider
The Google Calendar provider SHALL use the `googleapis` npm package to interact with Google Calendar API v3.

#### Scenario: Google Calendar provider initialization
- **WHEN** the provider is configured with `provider: google` and valid credentials
- **THEN** the provider SHALL initialize a Google Calendar client using the `googleapis` library

#### Scenario: Google Calendar OAuth token management
- **WHEN** the OAuth access token expires during operation
- **THEN** the provider SHALL attempt token refresh using the refresh token before failing

### Requirement: The system SHALL support MS Graph as a provider
The MS Graph provider SHALL use the `@microsoft/microsoft-graph-client` npm package to interact with Microsoft Graph API.

#### Scenario: MS Graph provider initialization
- **WHEN** the provider is configured with `provider: microsoft` and valid credentials
- **THEN** the provider SHALL initialize an MS Graph client using the `@microsoft/microsoft-graph-client` library

#### Scenario: MS Graph token management
- **WHEN** the access token expires during operation
- **THEN** the provider SHALL attempt token refresh using the configured refresh token or credentials

### Requirement: The system SHALL validate provider credentials
Both providers SHALL validate that required credentials are present before accepting calendar operations.

#### Scenario: Missing credentials
- **WHEN** a provider is initialized without required credentials
- **THEN** the provider SHALL throw a `CalendarAuthError` with a message indicating which credentials are missing

#### Scenario: Invalid credentials format
- **WHEN** credentials are provided but fail format validation (e.g., malformed JSON for OAuth tokens)
- **THEN** the provider SHALL throw a `CalendarAuthError` with a descriptive message