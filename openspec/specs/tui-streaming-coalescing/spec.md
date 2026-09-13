# tui-streaming-coalescing Specification

## Purpose
TBD - created by archiving change timing-aware-streaming-coalescing. Update Purpose after archive.
## Requirements
### Requirement: Coalesce same-type segments by appending
The streaming segment coalescing logic SHALL append content to the last segment when the incoming segment has the same type as the last segment.

#### Scenario: Append message to last message segment
- **WHEN** an incoming `message` segment follows a last segment of type `message`
- **THEN** the incoming content is appended to the last message segment

#### Scenario: Append reasoning to last reasoning segment
- **WHEN** an incoming `reasoning` segment follows a last segment of type `reasoning`
- **THEN** the incoming content is appended to the last reasoning segment

### Requirement: Coalesce reasoning-to-message within timeout and without punctuation
The streaming segment coalescing logic SHALL append an incoming `message` segment to the last `message` segment when a last message segment exists, does not end with sentence-ending punctuation (`.`, `!`, `?`), and the incoming segment arrived within the coalesce timeout of the last message segment.

#### Scenario: Append message to last message segment when no punctuation and within timeout
- **WHEN** an incoming `message` segment follows a last `message` segment that does not end with `.`, `!`, or `?` and arrived within the coalesce timeout
- **THEN** the incoming content is appended to the last message segment

#### Scenario: Push new message segment when last message segment ends with punctuation
- **WHEN** an incoming `message` segment follows a last `message` segment that ends with `.`, `!`, or `?`
- **THEN** a new message segment is pushed

#### Scenario: Push new message segment when gap exceeds timeout
- **WHEN** an incoming `message` segment follows a last `message` segment that does not end with punctuation but arrived after the coalesce timeout
- **THEN** a new message segment is pushed

### Requirement: Coalesce message-to-reasoning within timeout
The streaming segment coalescing logic SHALL append an incoming `reasoning` segment to the last `reasoning` segment when a last reasoning segment exists and the incoming segment arrived within the coalesce timeout of the last reasoning segment.

#### Scenario: Append reasoning to last reasoning segment within timeout
- **WHEN** an incoming `reasoning` segment follows a last `reasoning` segment and arrived within the coalesce timeout
- **THEN** the incoming content is appended to the last reasoning segment

#### Scenario: Push new reasoning segment when gap exceeds timeout
- **WHEN** an incoming `reasoning` segment follows a last `reasoning` segment but arrived after the coalesce timeout
- **THEN** a new reasoning segment is pushed

### Requirement: Coalesce timeout is a tunable constant
The coalesce timeout SHALL be defined as a named constant so it can be tuned against measured data.

#### Scenario: Timeout constant is exported
- **WHEN** the coalescing module is imported
- **THEN** a named constant `SEGMENT_COALESCE_TIMEOUT_MS` is available with a value of `250`

### Requirement: Coalescing logs real inter-segment gaps
The coalescing logic SHALL log the measured gap between segments for cross-type transitions via the structured logger, so the provisional timeout can be tuned against measured data.

#### Scenario: Cross-type transition logs gap
- **WHEN** a cross-type transition is evaluated
- **THEN** the measured gap is logged via the structured logger

### Requirement: Coalescing is a pure function
The coalescing decision SHALL be implemented as a pure, exported function that returns the merged segments and the measured gap.

#### Scenario: Pure function returns segments and gap
- **WHEN** the coalescing function is called with existing segments, a new segment, and a timeout
- **THEN** it returns an object containing the merged `segments` array and the measured `gap`

