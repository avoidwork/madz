# security-scanning Specification

## Purpose
TBD - created by archiving change bundled-polyglot-project-toolkit-skills. Update Purpose after archive.
## Requirements
### Requirement: Dependency CVE scanning
The system SHALL scan project dependencies for known CVEs using available vulnerability scanners.

#### Scenario: npm dependency scanning with grype
- **WHEN** the project uses npm and grype is available
- **THEN** the system runs grype against the lock file and reports CVE findings

#### Scenario: Maven dependency scanning with trivy
- **WHEN** the project uses Maven and trivy is available
- **THEN** the system runs trivy fs against the project directory and reports CVE findings

#### Scenario: Missing scanner fallback
- **WHEN** no vulnerability scanner is available
- **THEN** the system reports a clear error message listing the missing tools and installation instructions

### Requirement: SAST scanning
The system SHALL run static application security testing using semgrep with language-appropriate rules.

#### Scenario: JavaScript SAST scanning
- **WHEN** the project uses JavaScript/TypeScript and semgrep is available
- **THEN** the system runs semgrep with JavaScript-specific rulesets

#### Scenario: Java SAST scanning
- **WHEN** the project uses Java and semgrep is available
- **THEN** the system runs semgrep with Java-specific rulesets

#### Scenario: Missing semgrep fallback
- **WHEN** semgrep is not available
- **THEN** the system reports a clear error message with installation instructions

### Requirement: Secret scanning
The system SHALL scan the codebase for accidentally committed secrets using gitleaks.

#### Scenario: Secret scanning with gitleaks
- **WHEN** gitleaks is available
- **THEN** the system runs gitleaks on the project directory and reports any findings

#### Scenario: Missing gitleaks fallback
- **WHEN** gitleaks is not available
- **THEN** the system reports a clear error message with installation instructions

### Requirement: Container scanning
The system SHALL scan Docker images for vulnerabilities using trivy when applicable.

#### Scenario: Container image scanning
- **WHEN** a Dockerfile exists and trivy is available
- **THEN** the system runs trivy image against the built image and reports CVE findings

#### Scenario: Missing trivy fallback
- **WHEN** trivy is not available
- **THEN** the system reports a clear error message with installation instructions

