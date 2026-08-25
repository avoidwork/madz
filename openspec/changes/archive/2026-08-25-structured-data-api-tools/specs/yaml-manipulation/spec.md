## ADDED Requirements

### Requirement: YAML tool parses YAML strings
The YAML manipulation tool SHALL parse YAML strings into structured objects.

#### Scenario: Valid YAML string is parsed
- **WHEN** the user provides a valid YAML string with action "parse"
- **THEN** the tool returns the parsed JavaScript object

#### Scenario: Invalid YAML string is rejected
- **WHEN** the user provides an invalid YAML string
- **THEN** the tool returns an error with a descriptive message

### Requirement: YAML tool serializes objects to YAML strings
The YAML manipulation tool SHALL serialize JavaScript objects to YAML strings.

#### Scenario: Object is serialized to YAML
- **WHEN** the user provides an object with action "serialize"
- **THEN** the tool returns a valid YAML string

#### Scenario: Object with options is serialized
- **WHEN** the user specifies YAML output options
- **THEN** the tool returns a formatted YAML string

### Requirement: YAML tool transforms data
The YAML manipulation tool SHALL transform YAML data using mapping rules.

#### Scenario: Simple key mapping
- **WHEN** the user provides a mapping rule to rename keys
- **THEN** the tool returns the transformed YAML with renamed keys

#### Scenario: Nested transformation
- **WHEN** the user provides a mapping rule for nested paths
- **THEN** the tool returns the transformed YAML with nested changes applied

### Requirement: YAML tool filters data with path expressions
The YAML manipulation tool SHALL filter YAML data using path-based expressions.

#### Scenario: Path filter returns matching values
- **WHEN** the user provides a path expression
- **THEN** the tool returns all matching values from the YAML data

#### Scenario: Path filter returns empty result
- **WHEN** the path expression matches no values
- **THEN** the tool returns an empty array

### Requirement: YAML tool supports path-based access
The YAML manipulation tool SHALL access YAML values using path-based expressions.

#### Scenario: Simple path access
- **WHEN** the user provides a dot-notation path
- **THEN** the tool returns the value at that path

#### Scenario: Array index access
- **WHEN** the user provides a path with array index
- **THEN** the tool returns the value at the specified array index
