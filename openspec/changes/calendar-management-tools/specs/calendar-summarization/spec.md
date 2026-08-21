## ADDED Requirements

### Requirement: The system SHALL generate meeting summaries
The `generateSummary` tool SHALL produce structured summaries of calendar events from their metadata, descriptions, and attached notes.

#### Scenario: Generate summary of past events
- **WHEN** the user requests a summary of events from a date range
- **THEN** the system SHALL return a structured summary including event titles, times, attendees, and descriptions

#### Scenario: Generate summary of upcoming events
- **WHEN** the user requests a summary of upcoming events
- **THEN** the system SHALL return a structured summary with event titles, times, and locations

#### Scenario: Generate summary with duration filter
- **WHEN** the user specifies a minimum duration
- **THEN** the system SHALL only include events meeting the duration threshold

#### Scenario: Generate summary with attendee filter
- **WHEN** the user specifies an attendee email
- **THEN** the system SHALL only include events where that attendee is listed

#### Scenario: Generate summary with no matching events
- **WHEN** no events match the provided filters
- **THEN** the system SHALL return an empty summary with a message indicating no matching events