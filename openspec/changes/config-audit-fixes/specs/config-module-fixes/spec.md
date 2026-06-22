## ADDED Requirements

### Requirement: Config loader handles malformed YAML gracefully
The system SHALL catch YAML parse errors during config loading and fall back to DEFAULT_CONFIG.

#### Scenario: Malformed YAML file exists
- **WHEN** config.yaml exists but contains invalid YAML syntax
- **THEN** loadConfig() logs the error and returns DEFAULT_CONFIG without crashing

#### Scenario: Valid YAML file exists
- **WHEN** config.yaml exists and contains valid YAML
- **THEN** loadConfig() parses, merges with DEFAULT_CONFIG, resolves env vars, and validates as before

### Requirement: Config mutation persists before mutating memory
The system SHALL write config to disk before mutating the in-memory config object.

#### Scenario: Write succeeds
- **WHEN** setConfigValue() is called with valid input and disk write succeeds
- **THEN** in-memory config is mutated and returns true

#### Scenario: Write fails
- **WHEN** setConfigValue() is called and writeFileSync throws
- **THEN** in-memory config is unchanged and an Error is thrown

### Requirement: assignPath validates object input
The system SHALL validate that assignPath() receives a non-null object argument.

#### Scenario: null input
- **WHEN** assignPath(null, "a.b", 1) is called
- **THEN** a descriptive Error is thrown

#### Scenario: undefined input
- **WHEN** assignPath(undefined, "a.b", 1) is called
- **THEN** a descriptive Error is thrown

#### Scenario: non-object input
- **WHEN** assignPath("string", "a.b", 1) is called
- **THEN** a descriptive Error is thrown

#### Scenario: valid object input
- **WHEN** assignPath({}, "a.b", 1) is called
- **THEN** the value is assigned correctly