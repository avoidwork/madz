## MODIFIED Requirements

### Requirement: Config-gated registration
The `decision` tool SHALL be registered only when `agent.decision.baseUrl` is present in the config.

#### Scenario: baseUrl configured
- **WHEN** `agent.decision.baseUrl` is a non-empty string
- **THEN** the `decision` tool SHALL be registered in the tool index

#### Scenario: baseUrl empty
- **WHEN** `agent.decision.baseUrl` is an empty string
- **THEN** the `decision` tool SHALL NOT be registered in the tool index

### Requirement: Decision config threaded at invoke time
The `decision` tool SHALL receive the configured `decisionConfig` at invoke time so it uses the configured `agent.decision.baseUrl` instead of failing with a "not configured" error.

#### Scenario: Configured decision config is used
- **WHEN** the `decision` tool is registered with `agent.decision.baseUrl` set and is invoked
- **THEN** `decisionImpl` SHALL receive a populated `decisionConfig` and SHALL call the configured Ollama `/v1/systemone` endpoint

#### Scenario: Decision config not threaded
- **WHEN** the `decision` tool is registered but `decisionConfig` is not threaded through at invoke time
- **THEN** `decisionImpl` SHALL NOT return a misleading "not configured" error when `agent.decision.baseUrl` is set
