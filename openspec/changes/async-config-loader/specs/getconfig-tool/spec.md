# getconfig-tool Specification

## MODIFIED Requirements

### Requirement: getConfig returns parsed config
The system SHALL provide a `getConfig` tool that calls `loadConfig()` and returns the parsed JSON configuration object to the calling agent. The tool SHALL `await` the async `loadConfig()` function.

#### Scenario: Successful config retrieval
- **WHEN** an agent invokes the `getConfig` tool
- **THEN** the tool SHALL `await` `loadConfig()` and return the complete parsed configuration object

#### Scenario: Config contains expected structure
- **WHEN** an agent invokes the `getConfig` tool
- **THEN** the returned object SHALL contain all keys present in the project's `config.yaml` after env-var resolution and validation

### Requirement: Error propagation
The system SHALL propagate errors from `loadConfig()` without swallowing or transforming them.

#### Scenario: Missing config file
- **WHEN** `loadConfig()` throws due to a missing or unreadable config file
- **THEN** the `getConfig` tool SHALL throw the same error

#### Scenario: Parse error
- **WHEN** `loadConfig()` throws due to invalid YAML syntax
- **THEN** the `getConfig` tool SHALL throw the same error

#### Scenario: Validation failure
- **WHEN** `loadConfig()` throws due to schema validation failure
- **THEN** the `getConfig` tool SHALL throw the same error
