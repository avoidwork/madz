## ADDED Requirements

### Requirement: The system SHALL check calendar availability
The `checkAvailability` tool SHALL find free time slots within a specified date range and time window.

#### Scenario: Find free slots in a single day
- **WHEN** the user requests free slots for a specific date and duration
- **THEN** the system SHALL return all available time slots of at least that duration

#### Scenario: Find free slots across multiple days
- **WHEN** the user requests free slots across a date range
- **THEN** the system SHALL return available slots for each day in the range

#### Scenario: Find free slots excluding existing events
- **WHEN** the user has existing events on the requested dates
- **THEN** the system SHALL exclude those events from available slots

#### Scenario: Find free slots with buffer time
- **WHEN** the user specifies a buffer time between events
- **THEN** the system SHALL respect the buffer when calculating available slots

#### Scenario: No available slots
- **WHEN** the requested date range has no available slots of the requested duration
- **THEN** the system SHALL return an empty list with a message indicating no available slots

### Requirement: The system SHALL detect scheduling conflicts
The system SHALL identify conflicts when creating or updating events.

#### Scenario: Detect overlapping events
- **WHEN** a new event is created that overlaps with an existing event
- **THEN** the system SHALL return a `CalendarConflictError` with details of the conflicting event

#### Scenario: Detect attendee conflicts
- **WHEN** an attendee is already in another event at the requested time
- **THEN** the system SHALL warn the user about the attendee conflict

### Requirement: The system SHALL handle timezone conversions
All availability checks SHALL respect the user's configured timezone.

#### Scenario: Availability across timezone boundaries
- **WHEN** the user requests availability spanning midnight in their timezone
- **THEN** the system SHALL correctly identify free slots across the boundary

#### Scenario: Availability during DST transition
- **WHEN** the requested date range includes a DST transition
- **THEN** the system SHALL correctly handle the hour shift without creating duplicate or missing slots