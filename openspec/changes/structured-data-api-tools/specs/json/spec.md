## ADDED Requirements

### Requirement: JSON parsing and serialization
The system SHALL provide JSON parsing and serialization capabilities with error handling for malformed input.

#### Scenario: Parse valid JSON string
- **WHEN** the user calls the json tool with action "parse" and a valid JSON string
- **THEN** the system returns the parsed JSON object

#### Scenario: Parse invalid JSON string
- **WHEN** the user calls the json tool with action "parse" and an invalid JSON string
- **THEN** the system returns a structured error with the parse error details

#### Scenario: Serialize JSON object to string
- **WHEN** the user calls the json tool with action "serialize" and a JSON object
- **THEN** the system returns a formatted JSON string

#### Scenario: Serialize with custom indentation
- **WHEN** the user calls the json tool with action "serialize" and an indentation option
- **THEN** the system returns a JSON string formatted with the specified indentation

### Requirement: JSON path-based access
The system SHALL provide JSON path-based access using JSONPath expressions.

#### Scenario: Access nested property via JSONPath
- **WHEN** the user calls the json tool with action "filter" and a JSONPath expression
- **THEN** the system returns the values matching the JSONPath expression

#### Scenario: Access root property via JSONPath
- **WHEN** the user calls the json tool with action "filter" and a root JSONPath expression
- **THEN** the system returns the root property value

#### Scenario: JSONPath returns no matches
- **WHEN** the user calls the json tool with action "filter" and a JSONPath expression that matches nothing
- **THEN** the system returns an empty array

### Requirement: JSON transformation
The system SHALL provide JSON transformation capabilities with mapping rules.

#### Scenario: Transform JSON with field mapping
- **WHEN** the user calls the json tool with action "transform" and a mapping rule
- **THEN** the system returns the transformed JSON with fields renamed per the mapping

#### Scenario: Transform JSON with field removal
- **WHEN** the user calls the json tool with action "transform" and a field removal rule
- **THEN** the system returns the JSON with specified fields removed
