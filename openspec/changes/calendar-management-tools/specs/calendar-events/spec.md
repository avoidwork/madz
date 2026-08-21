## ADDED Requirements

### Requirement: The system SHALL list calendar events with filtering
The `listEvents` tool SHALL fetch calendar events with support for date range filtering, calendar selection, attendee filtering, and keyword search.

#### Scenario: List events within date range
- **WHEN** the user requests events between two dates
- **THEN** the system SHALL return events where the event start time falls within the specified range

#### Scenario: List events with keyword filter
- **WHEN** the user provides a keyword search term
- **THEN** the system SHALL return events whose title, description, or attendee list contains the keyword

#### Scenario: List events from specific calendar
- **WHEN** the user specifies a calendar ID
- **THEN** the system SHALL return events only from that calendar

#### Scenario: List events with default parameters
- **WHEN** no parameters are provided
- **THEN** the system SHALL return the next 10 events from the default calendar

#### Scenario: List events with pagination
- **WHEN** the result set exceeds the page size
- **THEN** the system SHALL return a pagination token for retrieving the next page

### Requirement: The system SHALL create calendar events
The `createEvent` tool SHALL create new calendar events with title, start/end times, attendees, location, and description.

#### Scenario: Create event with minimal parameters
- **WHEN** the user provides a title and start/end time
- **THEN** the system SHALL create an event with those parameters and return the event ID

#### Scenario: Create event with attendees
- **WHEN** the user provides attendee email addresses
- **THEN** the system SHALL add attendees to the event and send calendar invitations

#### Scenario: Create event with location and description
- **WHEN** the user provides location and description fields
- **THEN** the system SHALL store both fields in the event

#### Scenario: Create event with invalid time range
- **WHEN** the end time is before the start time
- **THEN** the system SHALL reject the request with a validation error

#### Scenario: Create event with timezone
- **WHEN** the user provides a timezone identifier
- **THEN** the system SHALL store the event in the specified timezone and convert to UTC internally

### Requirement: The system SHALL update calendar events
The `updateEvent` tool SHALL modify existing calendar events by event ID.

#### Scenario: Update event title
- **WHEN** the user provides an event ID and new title
- **THEN** the system SHALL update the event title and return the updated event

#### Scenario: Update event time
- **WHEN** the user provides an event ID and new start/end times
- **THEN** the system SHALL update the event times and notify attendees of the change

#### Scenario: Update event attendees
- **WHEN** the user adds or removes attendee email addresses
- **THEN** the system SHALL update the attendee list and send notifications

#### Scenario: Update non-existent event
- **WHEN** the provided event ID does not exist
- **THEN** the system SHALL return a `CalendarNotFoundError`

### Requirement: The system SHALL delete calendar events
The `deleteEvent` tool SHALL remove calendar events by event ID.

#### Scenario: Delete existing event
- **WHEN** the user provides a valid event ID
- **THEN** the system SHALL delete the event and send cancellation notifications to attendees

#### Scenario: Delete non-existent event
- **WHEN** the provided event ID does not exist
- **THEN** the system SHALL return a `CalendarNotFoundError`

#### Scenario: Delete event with confirmation
- **WHEN** the user provides a valid event ID and confirmation flag
- **THEN** the system SHALL delete the event only if the confirmation flag is true