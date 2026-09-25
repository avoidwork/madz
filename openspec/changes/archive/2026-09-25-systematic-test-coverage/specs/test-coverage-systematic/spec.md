## ADDED Requirements

### Requirement: Systematic per-file coverage improvement
The system SHALL iterate through all source files with coverage below 90%, one file at a time, writing or extending unit tests until each file reaches 90% line coverage before moving to the next.

#### Scenario: File with no test file gets a new test file
- **WHEN** a source file has no corresponding test file in `tests/unit/`
- **THEN** a new test file SHALL be created at the mirrored path under `tests/unit/`
- **THEN** the test file SHALL cover all public functions and classes in the source file
- **THEN** the file SHALL reach ≥90% line coverage

#### Scenario: File with existing tests below 90% gets extended tests
- **WHEN** a source file has an existing test file but coverage is below 90%
- **THEN** the existing test file SHALL be extended to cover uncovered lines
- **THEN** the file SHALL reach ≥90% line coverage

#### Scenario: Coverage verified after each file
- **WHEN** tests are written or extended for a file
- **THEN** `npm run coverage` SHALL be run to verify the file reached 90%
- **THEN** if 90% is not achievable, the reason SHALL be documented with `c8 ignore next` comments

### Requirement: External service mocking
The system SHALL mock external API dependencies to enable testing of provider modules without live credentials.

#### Scenario: Email provider tests use mocks
- **WHEN** testing email providers (Gmail, Graph, IMAP)
- **THEN** the Gmail API, Microsoft Graph API, and IMAP connections SHALL be mocked
- **THEN** tests SHALL verify provider interface contracts, not external API behavior

#### Scenario: Calendar provider tests use mocks
- **WHEN** testing calendar providers (Google, MS Graph)
- **THEN** the Google Calendar API and Microsoft Graph Calendar API SHALL be mocked
- **THEN** tests SHALL verify provider interface contracts, not external API behavior

### Requirement: Untestable path documentation
Code paths that cannot be tested SHALL be annotated and documented.

#### Scenario: Untestable path annotated
- **WHEN** a code path requires live credentials, OS-level behavior, or process signals that cannot be mocked
- **THEN** the path SHALL be annotated with `/* c8 ignore next */`
- **THEN** the reason SHALL be documented in the test file or a comment
