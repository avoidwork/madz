## ADDED Requirements

### Requirement: Code Review Agent Definition
The system SHALL provide a Code Review agent definition for structured code reviews.

#### Scenario: Code Review agent analyzes diffs
- **WHEN** the code review agent receives a diff
- **THEN** it identifies bugs, security issues, style violations, and performance concerns

#### Scenario: Code Review agent inspects files
- **WHEN** the code review agent needs context
- **THEN** it can read relevant files to understand the code

#### Scenario: Code Review agent generates reports
- **WHEN** the code review agent completes its analysis
- **THEN** it produces a structured review report with severity levels

### Requirement: Code Review Agent Tool Access
The Code Review agent SHALL have access to read_file, grep, glob, and executeCode tools.

#### Scenario: Code Review agent reads files
- **WHEN** the code review agent needs to inspect code
- **THEN** it can invoke the read_file tool

#### Scenario: Code Review agent searches code
- **WHEN** the code review agent needs to find patterns
- **THEN** it can invoke the grep tool

### Requirement: Code Review Agent Output Format
The Code Review agent SHALL produce structured output with severity levels and actionable recommendations.

#### Scenario: Review output includes severity
- **WHEN** the code review agent identifies an issue
- **THEN** the output includes a severity level (critical, high, medium, low)

#### Scenario: Review output includes recommendations
- **WHEN** the code review agent identifies an issue
- **THEN** the output includes actionable recommendations
