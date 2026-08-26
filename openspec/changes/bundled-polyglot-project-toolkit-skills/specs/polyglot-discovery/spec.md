## ADDED Requirements

### Requirement: Project language detection
The system SHALL detect the primary programming language of a project by scanning for language-specific indicator files in a defined priority order.

#### Scenario: Node.js project detection
- **WHEN** a project root contains a `package.json` file
- **THEN** the system reports the language as "TypeScript/JavaScript" with `package.json` as the detected indicator

#### Scenario: Java Maven project detection
- **WHEN** a project root contains a `pom.xml` file
- **THEN** the system reports the language as "Java" with `pom.xml` as the detected indicator

#### Scenario: Go project detection
- **WHEN** a project root contains a `go.mod` file
- **THEN** the system reports the language as "Go" with `go.mod` as the detected indicator

#### Scenario: Python project detection
- **WHEN** a project root contains a `pyproject.toml` file
- **THEN** the system reports the language as "Python" with `pyproject.toml` as the detected indicator

#### Scenario: Rust project detection
- **WHEN** a project root contains a `Cargo.toml` file
- **THEN** the system reports the language as "Rust" with `Cargo.toml` as the detected indicator

#### Scenario: Multi-language monorepo
- **WHEN** a project root contains multiple language indicator files
- **THEN** the system reports all detected languages and marks the primary language based on priority order

### Requirement: Build system detection
The system SHALL detect the build system by mapping indicator files to their corresponding build tools.

#### Scenario: npm build system detection
- **WHEN** `package.json` is detected as the primary indicator
- **THEN** the system identifies the build system as "npm" and extracts available scripts from `package.json.scripts`

#### Scenario: Maven build system detection
- **WHEN** `pom.xml` is detected as the primary indicator
- **THEN** the system identifies the build system as "Maven" and suggests `mvn compile`, `mvn test`

#### Scenario: Go build system detection
- **WHEN** `go.mod` is detected as the primary indicator
- **THEN** the system identifies the build system as "Go" and suggests `go build`, `go test`

### Requirement: Test framework detection
The system SHALL detect the test framework by examining dependency declarations and config files.

#### Scenario: Jest test framework detection
- **WHEN** `package.json` contains `jest` in dependencies or devDependencies
- **THEN** the system identifies the test framework as "Jest"

#### Scenario: Vitest test framework detection
- **WHEN** `package.json` contains `vitest` in dependencies or devDependencies
- **THEN** the system identifies the test framework as "Vitest"

#### Scenario: Node built-in test detection
- **WHEN** `package.json` contains no test framework dependency but test files use `node --test` patterns
- **THEN** the system identifies the test framework as "Node built-in"

#### Scenario: JUnit test framework detection
- **WHEN** `pom.xml` contains `junit` dependency
- **THEN** the system identifies the test framework as "JUnit"

### Requirement: Command extraction
The system SHALL extract build, test, lint, and type-check commands from configuration files.

#### Scenario: npm script extraction
- **WHEN** `package.json` contains a `build` script
- **THEN** the system extracts the build command value from the scripts section

#### Scenario: Maven command extraction
- **WHEN** `pom.xml` is the primary indicator
- **THEN** the system extracts standard Maven commands (`mvn compile`, `mvn test`, `mvn package`)

#### Scenario: Go command extraction
- **WHEN** `go.mod` is the primary indicator
- **THEN** the system extracts standard Go commands (`go build`, `go test`, `go vet`)
