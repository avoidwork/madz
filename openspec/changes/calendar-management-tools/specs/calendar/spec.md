## ADDED Requirements

### Requirement: Calendar tools SHALL provide read, create, update, delete, checkAvailability, and generateSummary operations
The calendar tool module SHALL expose six operations for managing calendar events across supported providers (Google Calendar, Microsoft Graph). Each operation SHALL accept structured parameters via zod schemas and return typed results.

#### Scenario: List calendar events with date range filter
- **WHEN** the agent calls the listEvents operation with a date range (start, end) and optional calendar ID
- **THEN** the system returns an array of events within the specified range, sorted by start time

#### Scenario: Create a new calendar event
- **WHEN** the agent calls the createEvent operation with title, start time, end time, attendees, and optional location/description
- **THEN** the system creates the event on the configured provider and returns the event ID and confirmation

#### Scenario: Update an existing calendar event
- **WHEN** the agent calls the updateEvent operation with an event ID and a subset of fields to update
- **THEN** the system updates only the specified fields on the provider and returns the updated event

#### Scenario: Delete a calendar event
- **WHEN** the agent calls the deleteEvent operation with an event ID
- **THEN** the system removes the event from the provider and confirms deletion

#### Scenario: Check availability for a time slot
- **WHEN** the agent calls the checkAvailability operation with a date, duration, and optional attendee list
- **THEN** the system returns available time slots that do not conflict with existing events

#### Scenario: Generate a meeting summary
- **WHEN** the agent calls the generateSummary operation with a date range
- **THEN** the system returns a formatted summary of events in that range, including titles, times, and attendees

### Requirement: Calendar tools SHALL support Google Calendar API and Microsoft Graph API as provider backends
The system SHALL implement two provider adapters that conform to a common CalendarProvider interface. A factory pattern SHALL select the active provider based on configuration.

#### Scenario: Select Google Calendar provider from config
- **WHEN** config.yaml specifies provider as "google" under providers.calendar
- **THEN** the factory returns the Google Calendar provider adapter

#### Scenario: Select Microsoft Graph provider from config
- **WHEN** config.yaml specifies provider as "msgraph" under providers.calendar
- **THEN** the factory returns the Microsoft Graph provider adapter

#### Scenario: Handle missing provider configuration
- **WHEN** no provider is specified in config.yaml under providers.calendar
- **THEN** the system defaults to Google Calendar provider and logs a warning

### Requirement: Calendar tools SHALL be registered in the agent's tool registry with network:outbound permission
Calendar tools SHALL be registered in src/tools/index.js following the existing tool registration pattern, with appropriate permission tiers and classifications.

#### Scenario: Calendar tools are discoverable by the agent
- **WHEN** the agent queries available tools
- **THEN** calendar tools appear under a "calendar" namespace with their operation names

#### Scenario: Calendar tools require network:outbound permission
- **WHEN** the agent attempts to use a calendar tool
- **THEN** the permission system validates that network:outbound permission is granted

### Requirement: Calendar tools SHALL handle timezone conversions correctly
All calendar operations SHALL accept and return times in ISO 8601 format with timezone offsets. Events SHALL be stored internally in UTC and converted to the user's configured timezone for display.

#### Scenario: Event created with timezone offset is stored in UTC
- **WHEN** an event is created with start time "2026-08-15T14:00:00-04:00"
- **THEN** the system stores the event as "2026-08-15T18:00:00Z" internally

#### Scenario: Event list returns times in user's configured timezone
- **WHEN** the user has configured timezone "America/Toronto" and lists events
- **THEN** returned event times are displayed in Eastern Time with appropriate DST offset

### Requirement: Calendar tools SHALL validate input parameters using zod schemas
All calendar tool operations SHALL validate their input parameters against zod schemas before making provider API calls. Invalid input SHALL return a structured error.

#### Scenario: Invalid date format is rejected
- **WHEN** an operation receives a date parameter that is not a valid ISO 8601 string
- **THEN** the system returns a validation error with a descriptive message

#### Scenario: Missing required fields are rejected
- **WHEN** createEvent is called without a title or start time
- **THEN** the system returns a validation error listing the missing required fields

### Requirement: Calendar tools SHALL implement OpenTelemetry instrumentation
All calendar tool operations SHALL be instrumented with OpenTelemetry spans for observability, following the existing telemetry patterns in src/telemetry/.

#### Scenario: Calendar tool execution is traced
- **WHEN** a calendar tool operation is invoked
- **THEN** an OpenTelemetry span is created with the operation name, input parameters (sanitized), and duration

#### Scenario: Calendar tool errors are recorded
- **WHEN** a calendar tool operation throws an error
- **THEN** the error is recorded on the OpenTelemetry span with status "error" and the error message

### Requirement: Calendar provider credentials SHALL be configurable via config.yaml
Provider credentials SHALL be stored in config.yaml under a new providers.calendar section, following the existing configuration patterns.

#### Scenario: Service account credentials are loaded from config
- **WHEN** config.yaml contains providers.calendar.credentials with service account configuration
- **THEN** the provider adapter uses these credentials for API authentication

#### Scenario: Credentials are never logged or exposed
- **WHEN** calendar operations execute with credentials loaded from config
- **THEN** credential values are never included in logs, error messages, or telemetry data