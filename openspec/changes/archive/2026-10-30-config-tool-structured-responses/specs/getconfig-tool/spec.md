# Spec Delta

## MODIFIED Requirements

### Requirement: getConfig returns parsed config
The system SHALL provide a `getConfig` tool that calls `loadConfig()` and returns a native structured object `{ ok: true, config }` where `config` is the parsed configuration object.

#### Scenario: Successful config retrieval
- **WHEN** an agent invokes the `getConfig` tool
- **THEN** the tool SHALL return `{ ok: true, config }` where `config` is the complete parsed configuration object as returned by `loadConfig()`

#### Scenario: Config contains expected structure
- **WHEN** an agent invokes the `getConfig` tool
- **THEN** the returned `config` object SHALL contain all keys present in the project's `config.yaml` after env-var resolution and validation

### Requirement: Error propagation
The system SHALL catch errors from `loadConfig()` and return a structured `{ ok: false, error }` response instead of throwing.

#### Scenario: Missing config file
- **WHEN** `loadConfig()` throws due to a missing or unreadable config file
- **THEN** the `getConfig` tool SHALL return `{ ok: false, error: <message> }` and SHALL NOT throw

#### Scenario: Parse error
- **WHEN** `loadConfig()` throws due to invalid YAML syntax
- **THEN** the `getConfig` tool SHALL return `{ ok: false, error: <message> }` and SHALL NOT throw

#### Scenario: Validation failure
- **WHEN** `loadConfig()` throws due to schema validation failure
- **THEN** the `getConfig` tool SHALL return `{ ok: false, error: <message> }` and SHALL NOT throw
