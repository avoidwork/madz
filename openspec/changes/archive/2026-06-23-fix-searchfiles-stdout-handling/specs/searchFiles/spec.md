## ADDED Requirements

### Requirement: searchFiles must handle undefined stdout safely
The searchFiles tool MUST ensure that stdout from the execFile call is always a string before calling string methods on it. If stdout is undefined or null, the tool MUST treat it as an empty string and return "No matches found."

#### Scenario: stdout is undefined
- **WHEN** the execFile call returns undefined stdout
- **THEN** the tool treats output as an empty string and returns "No matches found."

#### Scenario: stdout is null
- **WHEN** the execFile call returns null stdout
- **THEN** the tool treats output as an empty string and returns "No matches found."

#### Scenario: stdout is a valid string
- **WHEN** the execFile call returns a valid string stdout
- **THEN** the tool trims and splits the output as expected