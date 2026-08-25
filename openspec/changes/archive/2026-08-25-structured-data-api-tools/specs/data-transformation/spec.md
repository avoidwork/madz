## ADDED Requirements

### Requirement: Data tool converts between JSON and YAML
The data transformation tool SHALL convert data between JSON and YAML formats.

#### Scenario: JSON to YAML conversion
- **WHEN** the user provides JSON input with format "yaml" as target
- **THEN** the tool returns the data as a YAML string

#### Scenario: YAML to JSON conversion
- **WHEN** the user provides YAML input with format "json" as target
- **THEN** the tool returns the data as a JSON string

### Requirement: Data tool converts between JSON and CSV
The data transformation tool SHALL convert data between JSON and CSV formats.

#### Scenario: JSON array to CSV
- **WHEN** the user provides a JSON array of objects with format "csv" as target
- **THEN** the tool returns a CSV string with headers and rows

#### Scenario: CSV to JSON array
- **WHEN** the user provides a CSV string with format "json" as target
- **THEN** the tool returns a JSON array of objects with headers as keys

### Requirement: Data tool applies mapping rules during conversion
The data transformation tool SHALL apply mapping rules to transform field names during conversion.

#### Scenario: Mapping rule applied during JSON to CSV
- **WHEN** the user provides mapping rules with JSON to CSV conversion
- **THEN** the tool applies the mapping to column headers in the CSV output

#### Scenario: Mapping rule applied during CSV to JSON
- **WHEN** the user provides mapping rules with CSV to JSON conversion
- **THEN** the tool applies the mapping to object keys in the JSON output

### Requirement: Data tool validates input format
The data transformation tool SHALL validate that input data matches the specified format.

#### Scenario: Invalid JSON input is rejected
- **WHEN** the user provides invalid JSON with format "json"
- **THEN** the tool returns an error with a descriptive message

#### Scenario: Invalid CSV input is rejected
- **WHEN** the user provides malformed CSV with format "csv"
- **THEN** the tool returns an error with a descriptive message
