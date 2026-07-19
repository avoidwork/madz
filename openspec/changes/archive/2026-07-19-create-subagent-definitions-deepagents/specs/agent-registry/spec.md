## ADDED Requirements

### Requirement: Agent Registry
The system SHALL provide an agent registry that stores and manages subagent definitions.

#### Scenario: Registry stores agent definitions
- **WHEN** a subagent definition is registered
- **THEN** the registry stores the definition and can retrieve it by name

#### Scenario: Registry validates on registration
- **WHEN** a subagent definition is added to the registry
- **THEN** the registry validates the definition and rejects invalid definitions

#### Scenario: Registry supports listing agents
- **WHEN** the registry is queried for all registered agents
- **THEN** it returns a list of all registered agent names and metadata

### Requirement: Agent Lifecycle Management
The registry SHALL support adding, removing, and listing agents.

#### Scenario: Agent can be removed
- **WHEN** an agent is removed from the registry
- **THEN** the agent is no longer available for invocation

#### Scenario: Agent can be listed
- **WHEN** the registry is queried for agent information
- **THEN** it returns the agent's name, system prompt, and tool classifications
