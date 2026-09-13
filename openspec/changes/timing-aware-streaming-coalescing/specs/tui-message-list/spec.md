## ADDED Requirements

### Requirement: updateMessage coalesces streaming segments
The `updateMessage` function SHALL coalesce incoming streaming segments into the message's ordered `segments` array using a timing-aware and punctuation-aware rule, rather than a purely type-based rule.

#### Scenario: Same-type segments are appended
- **WHEN** `updateMessage` receives a segment whose type matches the last segment
- **THEN** the incoming content is appended to the last segment

#### Scenario: Cross-type message segment appends within timeout
- **WHEN** `updateMessage` receives a `message` segment following a last `message` segment that does not end with sentence-ending punctuation and arrived within the coalesce timeout
- **THEN** the incoming content is appended to the last message segment

#### Scenario: Cross-type message segment pushes a new block after timeout
- **WHEN** `updateMessage` receives a `message` segment following a last `message` segment that arrived after the coalesce timeout
- **THEN** a new message segment is pushed

#### Scenario: Cross-type reasoning segment appends within timeout
- **WHEN** `updateMessage` receives a `reasoning` segment following a last `reasoning` segment that arrived within the coalesce timeout
- **THEN** the incoming content is appended to the last reasoning segment

#### Scenario: Cross-type reasoning segment pushes a new block after timeout
- **WHEN** `updateMessage` receives a `reasoning` segment following a last `reasoning` segment that arrived after the coalesce timeout
- **THEN** a new reasoning segment is pushed
