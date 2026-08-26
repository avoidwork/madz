# build-execution Specification

## Purpose
TBD - created by archiving change bundled-polyglot-project-toolkit-skills. Update Purpose after archive.
## Requirements
### Requirement: Build command execution
The system SHALL execute the correct build command for the detected project stack.

#### Scenario: npm build execution
- **WHEN** the project uses npm as the build system
- **THEN** the system executes `npm run build` (or the value of the build script from package.json)

#### Scenario: Maven build execution
- **WHEN** the project uses Maven as the build system
- **THEN** the system executes `mvn compile` and reports compilation status

#### Scenario: Go build execution
- **WHEN** the project uses Go as the build system
- **THEN** the system executes `go build ./...` and reports build status

#### Scenario: Missing build command
- **WHEN** no build command is defined for the detected stack
- **THEN** the system reports available commands and suggests alternatives

### Requirement: Type-checking execution
The system SHALL execute type-checking commands appropriate for the detected language.

#### Scenario: TypeScript type checking
- **WHEN** the project uses TypeScript (package.json with typescript dependency)
- **THEN** the system executes `npx tsc --noEmit` or the configured type-check script

#### Scenario: Java type checking
- **WHEN** the project uses Java (pom.xml detected)
- **THEN** the system executes `mvn compile` which includes type checking

#### Scenario: No type checker available
- **WHEN** the detected language has no type checker or it is not configured
- **THEN** the system reports that type checking is not applicable

### Requirement: Linting execution
The system SHALL execute linting commands appropriate for the detected language.

#### Scenario: JavaScript linting with oxlint
- **WHEN** the project uses JavaScript/TypeScript and oxlint is configured
- **THEN** the system executes `npx oxlint` and reports lint findings

#### Scenario: Python linting with ruff
- **WHEN** the project uses Python and ruff is available
- **THEN** the system executes `ruff check .` and reports lint findings

#### Scenario: Go linting
- **WHEN** the project uses Go
- **THEN** the system executes `golangci-lint run` or `go vet ./...`

### Requirement: Test execution
The system SHALL execute tests using the detected test framework.

#### Scenario: Jest test execution
- **WHEN** Jest is detected as the test framework
- **THEN** the system executes `npx jest` with appropriate flags

#### Scenario: Maven test execution
- **WHEN** Maven is detected as the build system
- **THEN** the system executes `mvn test` and reports test results

#### Scenario: Go test execution
- **WHEN** Go is detected as the language
- **THEN** the system executes `go test ./...` and reports test results

