# Spec Delta

## MODIFIED Requirements

### Requirement: Permission model
The `decision` tool SHALL require `network:outbound` permission and SHALL be available to the orchestrator and the `coding`, `research`, `code-review`, `security-audit`, `debug`, `testing`, and `performance` subagents.

#### Scenario: Network permission required
- **WHEN** the tool index is built with `network:outbound` enabled and `agent.decision.baseUrl` set
- **THEN** the `decision` tool SHALL be registered

#### Scenario: Orchestrator availability
- **WHEN** the orchestrator tool list is queried
- **THEN** `decision` SHALL be present in `ORCHESTRATOR_TOOLS`

#### Scenario: Sub-agent availability
- **WHEN** a `coding`, `research`, `code-review`, `security-audit`, `debug`, `testing`, or `performance` subagent is created
- **THEN** `decision` SHALL be available to that agent

#### Scenario: Not available to synthesis subagents
- **WHEN** a `search`, `documentation`, `textEditor`, `seoAnalyst`, or `translator` subagent is created
- **THEN** `decision` SHALL NOT be available to that agent
