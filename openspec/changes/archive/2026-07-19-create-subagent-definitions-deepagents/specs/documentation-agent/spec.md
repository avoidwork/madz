## ADDED Requirements

### Requirement: Documentation Agent Definition
The system SHALL provide a Documentation agent definition for documentation updates and generation.

#### Scenario: Documentation agent updates READMEs
- **WHEN** the documentation agent receives a README file and changes
- **THEN** it updates the README to reflect the changes

#### Scenario: Documentation agent generates API docs
- **WHEN** the documentation agent receives source code with JSDoc
- **THEN** it generates API documentation from the JSDoc comments

#### Scenario: Documentation agent updates changelogs
- **WHEN** the documentation agent receives commit messages
- **THEN** it updates the CHANGELOG.md with the changes

### Requirement: Documentation Agent Tool Access
The Documentation agent SHALL have access to read_file, write_file, grep, and glob tools.

#### Scenario: Documentation agent reads files
- **WHEN** the documentation agent needs to understand content
- **THEN** it can invoke the read_file tool

#### Scenario: Documentation agent writes files
- **WHEN** the documentation agent generates documentation
- **THEN** it can invoke the write_file tool

### Requirement: Documentation Agent Output Format
The Documentation agent SHALL produce structured output with documentation changes and generated content.

#### Scenario: Documentation output includes changes
- **WHEN** the documentation agent updates documentation
- **THEN** the output includes the changes made

#### Scenario: Documentation output includes generated content
- **WHEN** the documentation agent generates documentation
- **THEN** the output includes the generated documentation content
