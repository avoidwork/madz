## ADDED Requirements

### Requirement: Safe dependency addition
The system SHALL add dependencies using the correct package manager for the detected project type.

#### Scenario: npm dependency addition
- **WHEN** the project uses npm as the package manager
- **THEN** the system executes `npm install <package>` and updates package.json and package-lock.json

#### Scenario: Maven dependency addition
- **WHEN** the project uses Maven
- **THEN** the system modifies pom.xml to add the dependency and runs `mvn dependency:resolve`

#### Scenario: Go dependency addition
- **WHEN** the project uses Go modules
- **THEN** the system executes `go get <package>` and updates go.mod and go.sum

### Requirement: Safe dependency removal
The system SHALL remove dependencies using the correct package manager.

#### Scenario: npm dependency removal
- **WHEN** the project uses npm
- **THEN** the system executes `npm uninstall <package>` and updates package.json and package-lock.json

#### Scenario: Maven dependency removal
- **WHEN** the project uses Maven
- **THEN** the system removes the dependency from pom.xml and runs `mvn dependency:resolve`

### Requirement: Dependency update with lock file management
The system SHALL update dependencies while maintaining lock file integrity.

#### Scenario: npm dependency update
- **WHEN** the project uses npm and a dependency needs updating
- **THEN** the system executes `npm update <package>` and verifies package-lock.json is updated

#### Scenario: Maven dependency update
- **WHEN** the project uses Maven and a dependency needs updating
- **THEN** the system updates the version in pom.xml and runs `mvn dependency:resolve`

### Requirement: Vulnerability pre-check before updates
The system SHALL check for known vulnerabilities before adding or updating dependencies.

#### Scenario: Pre-update vulnerability check
- **WHEN** adding or updating a dependency
- **THEN** the system runs a vulnerability check (grype or npm audit) before proceeding

#### Scenario: Vulnerability found before update
- **WHEN** a vulnerability is detected in the proposed dependency
- **THEN** the system warns the user and suggests a patched version
