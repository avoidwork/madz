# json-manipulation Specification

## Purpose
Provide JSON parsing, filtering, transformation, and serialization capabilities with JSONPath support.

## Requirements

### Requirement: JSON parsing
The system SHALL parse JSON strings into structured objects.

#### Scenario: Parse valid JSON string
- **WHEN** a valid JSON string is provided
- **THEN** the system returns the parsed JavaScript object

#### Scenario: Parse invalid JSON string
- **WHEN** an invalid JSON string is provided
- **THEN** the system returns an error with the parse error message

#### Scenario: Parse empty string
- **WHEN** an empty string is provided
- **THEN** the system returns an error

### Requirement: JSON serialization
The system SHALL serialize JavaScript objects into JSON strings.

#### Scenario: Serialize object
- **WHEN** a JavaScript object is provided
- **THEN** the system returns a valid JSON string

#### Scenario: Serialize with custom formatting
- **WHEN** a custom indent (e.g., 2 spaces) is specified
- **THEN** the system returns a formatted JSON string

#### Scenario: Serialize circular reference
- **WHEN** an object with circular references is provided
- **THEN** the system returns an error

### Requirement: JSONPath filtering
The system SHALL filter JSON data using JSONPath expressions.

#### Scenario: Filter by key
- **WHEN** a JSONPath expression "$.users[*].name" is provided
- **THEN** the system returns an array of all user names

#### Scenario: Filter by condition
- **WHEN** a JSONPath expression "$.items[?(@.price > 10)]" is provided
- **THEN** the system returns items with price greater than 10

#### Scenario: Filter with no matches
- **WHEN** a JSONPath expression matches no elements
- **THEN** the system returns an empty array

#### Scenario: Filter with invalid expression
- **WHEN** an invalid JSONPath expression is provided
- **THEN** the system returns an error

### Requirement: JSON transformation
The system SHALL transform JSON data using mapping rules.

#### Scenario: Transform with field rename
- **WHEN** a mapping rule renames "name" to "title"
- **THEN** the system returns the transformed object with "title" instead of "name"

#### Scenario: Transform with field addition
- **WHEN** a mapping rule adds a field "timestamp" with value from current time
- **THEN** the system returns the object with the new field

#### Scenario: Transform with field removal
- **WHEN** a mapping rule removes a field "password"
- **THEN** the system returns the object without the "password" field

### Requirement: JSON validation
The system SHALL validate JSON data against a schema.

#### Scenario: Valid JSON against schema
- **WHEN** JSON data matches the provided schema
- **THEN** the system returns { valid: true }

#### Scenario: Invalid JSON against schema
- **WHEN** JSON data does not match the provided schema
- **THEN** the system returns { valid: false, errors: [...] }