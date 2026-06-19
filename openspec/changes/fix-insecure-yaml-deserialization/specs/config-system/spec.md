## ADDED Requirements

### Requirement: Secure YAML Parsing
The system SHALL use safe YAML parsing (`yaml.safeLoad()`) when loading `config.yaml` to prevent arbitrary code execution via malicious YAML tags (e.g., `!!js/function`).

#### Scenario: Malicious YAML tag is rejected
- **WHEN** `config.yaml` contains a malicious YAML tag (e.g., `!!js/function`)
- **THEN** the system rejects the tag and does not execute arbitrary code

#### Scenario: Safe YAML parsing is used
- **WHEN** the application loads `config.yaml`
- **THEN** it uses `yaml.safeLoad()` instead of `yaml.load()` for safe parsing

#### Scenario: Standard YAML types are parsed correctly
- **WHEN** `config.yaml` contains standard YAML types (strings, numbers, booleans, arrays, objects)
- **THEN** the system parses them correctly without errors