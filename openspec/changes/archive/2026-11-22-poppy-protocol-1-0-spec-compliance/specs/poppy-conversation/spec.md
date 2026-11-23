# Spec Delta

## MODIFIED Requirements

### Requirement: Messages are sent to a conversation
The system SHALL send messages to a conversation via `POST {endpoint}/{id}/messages`, supporting request IDs for safe retries. Each message SHALL use the spec `author:{type}` shape with `text`/`data`/`context`/`extensions` fields, and the request ID SHALL be carried in the POST body.

#### Scenario: Message is sent to a conversation
- **WHEN** a message is sent to a conversation
- **THEN** the system sends a `POST` to `{endpoint}/{id}/messages` with the message body

#### Scenario: Request ID is sent for safe retries
- **WHEN** a request ID is provided for a message send
- **THEN** the system includes the request ID for idempotent retries

#### Scenario: Request ID conflict is reported
- **WHEN** a message send returns a `request_id_conflict` error
- **THEN** the system reports the error

#### Scenario: Message uses author type shape
- **WHEN** a message is sent to a conversation
- **THEN** the message uses the spec `author:{type}` shape with `text`/`data`/`context`/`extensions` fields rather than `role`/`content`

#### Scenario: Request ID is in the POST body
- **WHEN** a message is sent with a request ID
- **THEN** the request ID is included in the POST body

### Requirement: Conversations are started with a company's agent
The system SHALL start a conversation with a company's agent via `POST {endpoint}`, returning the created conversation. The start request SHALL include the first message and carry the request ID in the body.

#### Scenario: Conversation is started
- **WHEN** the agent starts a conversation with a company's endpoint
- **THEN** the system sends a `POST` to the endpoint and returns the created conversation

#### Scenario: Missing endpoint is reported
- **WHEN** a conversation is started without an endpoint
- **THEN** the system returns an error

#### Scenario: Non-HTTPS endpoint is rejected
- **WHEN** a conversation endpoint URL is not HTTPS
- **THEN** the system returns an error

#### Scenario: Start request includes the first message
- **WHEN** a conversation is started with a first message
- **THEN** the start request includes that first message

### Requirement: Events are read from a conversation
The system SHALL read events from a conversation via `GET {endpoint}/{id}/events`, supporting the `wait` and `cursor` query parameters. Each successful read SHALL validate the response shape including `conversation_id`, `events`, `cursor`, `has_more`, and the state fields `working`, `handoff`, `responder`, and `closed`.

#### Scenario: Events are read from a conversation
- **WHEN** events are read from a conversation
- **THEN** the system sends a `GET` to `{endpoint}/{id}/events` and returns the events

#### Scenario: Wait and cursor query parameters are sent
- **WHEN** the `wait` and `cursor` query parameters are provided
- **THEN** the system includes them in the events request

#### Scenario: Invalid cursor is reported
- **WHEN** the events request returns an `invalid_cursor` error
- **THEN** the system reports the error

#### Scenario: Cursor expired is reported
- **WHEN** the events request returns a `cursor_expired` error
- **THEN** the system reports the error

#### Scenario: Read response shape is validated
- **WHEN** a successful events read is returned
- **THEN** the system validates the response includes `conversation_id`, `events`, `cursor`, `has_more`, and the state fields `working`, `handoff`, `responder`, and `closed`

### Requirement: Conversation errors are handled per section 8.13
The system SHALL handle conversation errors per Poppy spec section 8.13: `conversation_not_found`, `conversation_closed`, `direct_conversation_open`, `request_id_conflict`, `invalid_cursor`, `cursor_expired`, and `version_mismatch`. The system SHALL map `conversation_closed` and `direct_conversation_open` to 409, `cursor_expired` to 410, and `version_mismatch` to 409.

#### Scenario: Conversation not found is reported
- **WHEN** a conversation request returns a `conversation_not_found` error
- **THEN** the system reports the error

#### Scenario: Version mismatch is reported
- **WHEN** a conversation request returns a `version_mismatch` error
- **THEN** the system reports the error with status 409

#### Scenario: Conversation closed maps to 409
- **WHEN** a conversation request returns a `conversation_closed` error
- **THEN** the system reports the error with status 409

#### Scenario: Direct conversation open maps to 409
- **WHEN** a conversation request returns a `direct_conversation_open` error
- **THEN** the system reports the error with status 409

#### Scenario: Cursor expired maps to 410
- **WHEN** a conversation request returns a `cursor_expired` error
- **THEN** the system reports the error with status 410
