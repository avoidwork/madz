## ADDED Requirements

### Requirement: All source files achieve ≥90% line coverage

The system SHALL achieve at least 90% line coverage for every source file in the madz codebase, measured using c8 via `npm run coverage`.

#### Scenario: Priority files reach 90% coverage
- **WHEN** the test suite runs against the 14 priority files (spreadsheet/formulaParser.js, calendar/index.js, email/providers/graph.js, email/providers/gmail.js, compactContext/index.js, email/providers/imap.js, spreadsheet/pivot.js, calendar/providers/msgraph.js, calendar/providers/google.js, spreadsheet/stats.js, spreadsheet/spreadsheet.js, calendar/providers/base.js, calendar/providers/factory.js, email/providers/base.js)
- **THEN** each file reports ≥90% line coverage in the c8 coverage report

#### Scenario: No-test-file modules get new test files
- **WHEN** the test suite runs against modules without existing tests (scheduler/cron.js, session/shutdown.js, shared/logger.js, skills/registry.js, tools/yaml/index.js, tools/webhook/index.js)
- **THEN** each module has a corresponding test file in tests/unit/ and achieves ≥90% line coverage

### Requirement: External dependencies are mocked

The system SHALL mock all external service dependencies in tests — no real API calls to Gmail, Microsoft Graph, IMAP, or other external services.

#### Scenario: Gmail API calls are mocked
- **WHEN** tests exercise email/providers/gmail.js
- **THEN** all googleapis SDK calls are mocked and no network requests are made

#### Scenario: Microsoft Graph calls are mocked
- **WHEN** tests exercise email/providers/graph.js or calendar/providers/msgraph.js
- **THEN** all @microsoft/microsoft-graph-client SDK calls are mocked and no network requests are made

#### Scenario: IMAP connections are mocked
- **WHEN** tests exercise email/providers/imap.js
- **THEN** all imap-simple calls are mocked and no network requests are made

### Requirement: Untestable paths are documented

The system SHALL document code paths that cannot be tested without live credentials or hardware using `c8 ignore next` comments.

#### Scenario: Paths requiring live credentials are annotated
- **WHEN** a source file contains code paths that require live API credentials or hardware access
- **THEN** those lines are annotated with `c8 ignore next` comments and the reason is documented

### Requirement: Tests follow project conventions

The system SHALL follow the established testing conventions: Node.js 24+ ESM, `node --test` framework, 2-space indentation, 100-character max line length, JSDoc on all public functions, and no console.log in production code.

#### Scenario: Test files use node --test
- **WHEN** new test files are created
- **THEN** they use the `node --test` framework with `describe`/`it` blocks and `assert` assertions

#### Scenario: Test files mirror source structure
- **WHEN** a source file exists at src/tools/foo/bar.js
- **THEN** its test file is located at tests/unit/tools/foo/bar.test.js
