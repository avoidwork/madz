# test-environment Specification

## Purpose
TBD - created by archiving change bundled-polyglot-project-toolkit-skills. Update Purpose after archive.
## Requirements
### Requirement: Browser binary management
The system SHALL manage browser binaries for end-to-end testing frameworks.

#### Scenario: Playwright Chromium installation
- **WHEN** the project uses Playwright and Chromium is not installed
- **THEN** the system executes `npx playwright install chromium` and verifies the binary

#### Scenario: Puppeteer Chrome installation
- **WHEN** the project uses Puppeteer and Chrome is not installed
- **THEN** the system executes `npx puppeteer browsers install chrome` and verifies the binary

#### Scenario: Browser binary verification
- **WHEN** browser binaries are requested
- **THEN** the system verifies the binary exists and is executable before proceeding

### Requirement: Test database setup
The system SHALL set up test databases for integration testing.

#### Scenario: PostgreSQL test database
- **WHEN** the project requires PostgreSQL for testing
- **THEN** the system creates a test database, runs migrations, and seeds test data

#### Scenario: SQLite test database
- **WHEN** the project uses SQLite for testing
- **THEN** the system creates an in-memory or file-based SQLite database with migrations applied

### Requirement: Mock service configuration
The system SHALL configure mock services for isolated testing.

#### Scenario: Mock SMTP server
- **WHEN** the project sends emails in tests
- **THEN** the system configures a mock SMTP server (e.g., mailhog, nodemailer smtp transport)

#### Scenario: Mock external API
- **WHEN** the project calls external APIs in tests
- **THEN** the system configures a mock server (e.g., wiremock, nock) with test fixtures

