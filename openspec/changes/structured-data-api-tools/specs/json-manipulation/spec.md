## ADDED Requirements

### Requirement: JSON tool parses JSON strings
The JSON manipulation tool SHALL parse JSON strings into structured objects.

#### Scenario: Valid JSON string is parsed
- **WHEN** the user provides a valid JSON string with action "parse"
- **THEN** the tool returns the parsed JavaScript object

#### Scenario: Invalid JSON string is rejected
- **WHEN** the user provides an invalid JSON string
- **THEN** the tool returns an error with a descriptive message

### Requirement: JSON tool serializes objects to JSON strings
The JSON manipulation tool SHALL serialize JavaScript objects to JSON strings.

#### Scenario: Object is serialized to JSON
- **WHEN** the user provides an object with action "serialize"
- **THEN** the tool returns a valid JSON string

#### Scenario: Object with options is serialized
- **WHEN** the user specifies pretty-printing options
- **THEN** the tool returns a formatted JSON string with indentation

### Requirement: JSON tool transforms data
The JSON manipulation tool SHALL transform JSON data using mapping rules.

#### Scenario: Simple key mapping
- **WHEN** the user provides a mapping rule to rename keys
- **THEN** the tool returns the transformed JSON with renamed keys

#### Scenario: Nested transformation
- **WHEN** the user provides a mapping rule for nested paths
- **THEN** the tool returns the transformed JSON with nested changes applied

### Requirement: JSON tool filters data with JSONPath
The JSON manipulation tool SHALL filter JSON data using JSONPath expressions.

#### Scenario: JSONPath filter returns matching values
- **WHEN** the user provides a JSONPath expression
- **THEN** the tool returns all matching values from the JSON data

#### Scenario: JSONPath filter returns empty result
- **WHEN** the JSONPath expression matches no values
- **THEN** the tool returns an empty array

### Requirement: JSON tool supports path-based access
The JSON manipulation tool SHALL access JSON values using path-based expressions.

#### Scenario: Simple path access
- **WHEN** the user provides a dot-notation path
- **THEN** the tool returns the value at that path

#### Scenario: Array index access
- **WHEN** the user provides a path with array index
- **THEN** the tool returns the value at the specified array index
