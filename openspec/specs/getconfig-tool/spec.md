# getconfig-tool Specification

## Purpose
TBD - created by archiving change getconfig-tool. Update Purpose after archive.

## Requirements

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

### Requirement: Input validation
The `getConfig` tool SHALL accept no input parameters and SHALL reject extraneous input.

#### Scenario: No input required
- **WHEN** an agent invokes the `getConfig` tool with no arguments
- **THEN** the tool SHALL execute successfully and return the config

#### Scenario: Extraneous input rejected
- **WHEN** an agent invokes the `getConfig` tool with unexpected arguments
- **THEN** the tool SHALL throw a validation error

### Requirement: Permission model
The `getConfig` tool SHALL require only `filesystem:read` permission and SHALL be available to the orchestrator and sub-agents with `codeIndex` access.

#### Scenario: Read-only permission
- **WHEN** the tool index is built with `filesystem:read` enabled
- **THEN** the `getConfig` tool SHALL be registered

#### Scenario: Orchestrator availability
- **WHEN** the orchestrator tool list is queried
- **THEN** `getConfig` SHALL be present in `ORCHESTRATOR_TOOLS`

#### Scenario: Sub-agent availability
- **WHEN** a sub-agent with `codeIndex` classification is created
- **THEN** `getConfig` SHALL be available to that agent
