## ADDED Requirements

### Requirement: JSON to YAML conversion
The system SHALL convert JSON data to YAML format.

#### Scenario: Convert JSON object to YAML
- **WHEN** the user calls the data-transform tool with action "transform", input format "json", and output format "yaml"
- **THEN** the system returns the data as a YAML string

#### Scenario: Convert JSON array to YAML
- **WHEN** the user calls the data-transform tool with action "transform", input format "json", an array input, and output format "yaml"
- **THEN** the system returns the array as a YAML string

### Requirement: YAML to JSON conversion
The system SHALL convert YAML data to JSON format.

#### Scenario: Convert YAML string to JSON
- **WHEN** the user calls the data-transform tool with action "transform", input format "yaml", and output format "json"
- **THEN** the system returns the data as a JSON string

#### Scenario: Convert YAML multi-document to JSON array
- **WHEN** the user calls the data-transform tool with action "transform", input format "yaml" with multiple documents, and output format "json"
- **THEN** the system returns an array of JSON objects

### Requirement: JSON to CSV conversion
The system SHALL convert JSON data to CSV format.

#### Scenario: Convert JSON array of objects to CSV
- **WHEN** the user calls the data-transform tool with action "transform", input format "json", an array of objects, and output format "csv"
- **THEN** the system returns a CSV string with headers derived from object keys

#### Scenario: Convert JSON array with custom delimiter
- **WHEN** the user calls the data-transform tool with action "transform", input format "json", and a custom delimiter
- **THEN** the system returns a CSV string using the specified delimiter

### Requirement: CSV to JSON conversion
The system SHALL convert CSV data to JSON format.

#### Scenario: Convert CSV string to JSON array
- **WHEN** the user calls the data-transform tool with action "transform", input format "csv", and output format "json"
- **THEN** the system returns an array of objects with keys from the CSV header row

#### Scenario: Convert CSV with custom delimiter
- **WHEN** the user calls the data-transform tool with action "transform", input format "csv", and a custom delimiter
- **THEN** the system parses the CSV using the specified delimiter

### Requirement: Data transformation with mapping rules
The system SHALL apply field mapping rules during data transformation.

#### Scenario: Rename fields during transformation
- **WHEN** the user calls the data-transform tool with action "transform" and field mapping rules
- **THEN** the system returns the transformed data with fields renamed per the mapping

#### Scenario: Filter fields during transformation
- **WHEN** the user calls the data-transform tool with action "transform" and a field filter list
- **THEN** the system returns the transformed data with only the specified fields
