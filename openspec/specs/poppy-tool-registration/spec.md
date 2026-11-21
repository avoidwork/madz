# poppy-tool-registration Specification

## Purpose
Documents the registration of the `poppy` tool in madz's tool registry, its permission gating via `network:outbound`, its agent-type classification, and its exposure to the orchestrator.

## Requirements

### Requirement: Poppy tool is registered in the tool registry
The system SHALL register the `poppy` tool in `src/tools/index.js` with an entry in `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, and `TOOLS`, and SHALL expose it through `buildToolConfig()`.

#### Scenario: Poppy tool is present in the registry
- **WHEN** the tool registry is inspected
- **THEN** the `poppy` tool is present in `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, and `TOOLS`

### Requirement: Poppy tool requires network:outbound permission
The system SHALL gate the `poppy` tool behind the `network:outbound` permission, registering it only when that permission is enabled.

#### Scenario: Poppy tool registers when network:outbound is enabled
- **WHEN** `buildToolConfig()` is invoked with `network:outbound` enabled
- **THEN** the `poppy` tool is registered

#### Scenario: Poppy tool is absent when network:outbound is disabled
- **WHEN** `buildToolConfig()` is invoked without `network:outbound` enabled
- **THEN** the `poppy` tool is not registered

### Requirement: Poppy tool is classified for agent types
The system SHALL classify the `poppy` tool for the relevant agent types in `TOOL_CLASSIFICATIONS`, so subagents of those types receive the tool.

#### Scenario: Poppy tool is classified for orchestrator and research agents
- **WHEN** the `poppy` tool classification is inspected
- **THEN** the `poppy` tool is classified for the `orchestrator` and `research` agent types

### Requirement: Poppy tool is available to the orchestrator
The system SHALL list the `poppy` tool in `ORCHESTRATOR_TOOLS` so the orchestrator can invoke it.

#### Scenario: Poppy tool is exposed to the orchestrator
- **WHEN** the orchestrator tool set is inspected
- **THEN** the `poppy` tool is present in `ORCHESTRATOR_TOOLS`

### Requirement: Poppy tool key directory is injected server-side
The system SHALL inject the Poppy key directory into the `poppy` tool at registration time from `config.memory.toolsDir`, so the `identity` action can persist and load private signing keys without exposing key material to the model.

#### Scenario: Poppy tool receives the key directory
- **WHEN** the `poppy` tool is registered via `buildToolConfig()`
- **THEN** the tool's runtime options include the key directory derived from `config.memory.toolsDir`
