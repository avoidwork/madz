# poppy-conversation Specification

## Purpose
Lets madz start, send, read, and stream messages with a company's agent over the Poppy conversation protocol, including handoff to a person and direct conversations.

## Requirements

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

### Requirement: Events are streamed via SSE
The system SHALL stream events from a conversation via SSE (`Accept: text/event-stream`), handling `message`, `state`, `authorization`, `user_requested`, `direct_opened`, `direct_closed`, `working`, and `text-delta` events.

#### Scenario: Events are streamed via SSE
- **WHEN** the agent requests a streaming event stream from a conversation
- **THEN** the system sends a `GET` with `Accept: text/event-stream` and dispatches each event type

#### Scenario: Message event is handled
- **WHEN** a `message` event is received on the stream
- **THEN** the system dispatches the message event

#### Scenario: State event is handled
- **WHEN** a `state` event is received on the stream
- **THEN** the system dispatches the state event

#### Scenario: Authorization event is handled
- **WHEN** an `authorization` event is received on the stream
- **THEN** the system dispatches the authorization event

#### Scenario: User requested event is handled
- **WHEN** a `user_requested` event is received on the stream
- **THEN** the system dispatches the user requested event

#### Scenario: Direct opened event is handled
- **WHEN** a `direct_opened` event is received on the stream
- **THEN** the system dispatches the direct opened event

#### Scenario: Direct closed event is handled
- **WHEN** a `direct_closed` event is received on the stream
- **THEN** the system dispatches the direct closed event

#### Scenario: Working event is handled
- **WHEN** a `working` event is received on the stream
- **THEN** the system dispatches the working event

#### Scenario: Text delta event is handled
- **WHEN** a `text-delta` event is received on the stream
- **THEN** the system dispatches the text delta event

### Requirement: Handoff to a person is supported
The system SHALL support handoff to a person via `POST {endpoint}/{id}/handoff` and `POST {endpoint}/{id}/handoff/cancel`.

#### Scenario: Handoff to a person is initiated
- **WHEN** the agent requests a handoff to a person
- **THEN** the system sends a `POST` to `{endpoint}/{id}/handoff`

#### Scenario: Handoff is cancelled
- **WHEN** the agent cancels a handoff to a person
- **THEN** the system sends a `POST` to `{endpoint}/{id}/handoff/cancel`

#### Scenario: Conversation closed is reported
- **WHEN** a handoff request returns a `conversation_closed` error
- **THEN** the system reports the error

### Requirement: Direct conversations are supported
The system SHALL support direct conversations via `parent_conversation_id` and `user_requested_event_id` when starting a conversation.

#### Scenario: Direct conversation is started
- **WHEN** a conversation is started with a `parent_conversation_id` and `user_requested_event_id`
- **THEN** the system includes them in the start request

#### Scenario: Direct conversation open is reported
- **WHEN** a direct conversation start returns a `direct_conversation_open` error
- **THEN** the system reports the error

### Requirement: Conversation state fields are handled
The system SHALL handle conversation state fields `working`, `handoff`, `responder`, and `closed`.

#### Scenario: Conversation state is returned
- **WHEN** a conversation is read or streamed
- **THEN** the system surfaces the `working`, `handoff`, `responder`, and `closed` state fields

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
