# tool-schema-validation Specification

## Purpose
Define the requirements for tool schema resolution, caching, pre-call validation, and graceful mismatch handling in the orchestrator's system prompt.

## Requirements

### Requirement: Tool schema resolution at session start
The orchestrator SHALL fetch the complete tool list with schemas from the tool registry at session start.

#### Scenario: Tool schemas are resolved at session start
- **WHEN** a new session begins
- **THEN** the orchestrator fetches the complete tool list with schemas from the tool registry

### Requirement: Tool schema caching in session state
The orchestrator SHALL store the resolved tool list in session state so it persists across turns.

#### Scenario: Cached schemas persist across turns
- **WHEN** the orchestrator has resolved tool schemas at session start
- **THEN** the cached schemas are available for all subsequent turns within the same session

### Requirement: Pre-call tool existence validation
Before invoking any tool, the orchestrator SHALL verify the tool exists in the cached schema list.

#### Scenario: Tool exists in cache
- **WHEN** the orchestrator validates a tool call against the cached schema list
- **THEN** the tool is found and validation passes

#### Scenario: Tool missing from cache
- **WHEN** the orchestrator validates a tool call against the cached schema list
- **THEN** the tool is not found and the orchestrator clarifies with the user rather than failing silently

### Requirement: Pre-call parameter validation
Before invoking any tool, the orchestrator SHALL verify the provided parameters match the tool's schema.

#### Scenario: Parameters match schema
- **WHEN** the orchestrator validates parameters against the tool's schema
- **THEN** required fields are present and types are correct, validation passes

#### Scenario: Parameters don't match schema
- **WHEN** the orchestrator validates parameters against the tool's schema
- **THEN** missing required fields or incorrect types are detected and the orchestrator clarifies with the user

### Requirement: Graceful degradation on registry failure
If the tool registry is unavailable at session start, the orchestrator SHALL proceed with currently bound tools and log a warning.

#### Scenario: Registry unavailable at startup
- **WHEN** the tool registry cannot be reached at session start
- **THEN** the orchestrator proceeds with existing tools and logs a warning
