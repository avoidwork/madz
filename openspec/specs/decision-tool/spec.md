# decision-tool Specification

## Purpose
TBD - created by archiving change decision-tool. Update Purpose after archive.
## Requirements
### Requirement: decision tool returns structured answers
The system SHALL provide a `decision` tool that calls Ollama's `/v1/systemone` endpoint and returns the structured `answers` from the model.

#### Scenario: Successful classification
- **WHEN** an agent invokes the `decision` tool with a `state` and a `questions` record
- **THEN** the tool SHALL send the `state` and `questions` to the configured Ollama `/v1/systemone` endpoint and return the structured `answers`

#### Scenario: Choice question type
- **WHEN** a question has `type: "choice"` with `instructions` and `criteria`
- **THEN** the tool SHALL pass the question through to the model and return the selected answer

#### Scenario: Noul question type
- **WHEN** a question has `type: "noul"` (true/false)
- **THEN** the tool SHALL pass the question through to the model and return the boolean answer

#### Scenario: Score question type
- **WHEN** a question has `type: "score"` with `instructions` and `criteria`
- **THEN** the tool SHALL pass the question through to the model and return the numeric score

### Requirement: Config-gated registration
The `decision` tool SHALL be registered only when `agent.decision.baseUrl` is present in the config.

#### Scenario: baseUrl configured
- **WHEN** `agent.decision.baseUrl` is a non-empty string
- **THEN** the `decision` tool SHALL be registered in the tool index

#### Scenario: baseUrl empty
- **WHEN** `agent.decision.baseUrl` is an empty string
- **THEN** the `decision` tool SHALL NOT be registered in the tool index

### Requirement: Permission model
The `decision` tool SHALL require `network:outbound` permission and SHALL be available to the orchestrator and the `coding` and `research` subagents.

#### Scenario: Network permission required
- **WHEN** the tool index is built with `network:outbound` enabled and `agent.decision.baseUrl` set
- **THEN** the `decision` tool SHALL be registered

#### Scenario: Orchestrator availability
- **WHEN** the orchestrator tool list is queried
- **THEN** `decision` SHALL be present in `ORCHESTRATOR_TOOLS`

#### Scenario: Sub-agent availability
- **WHEN** a `coding` or `research` subagent is created
- **THEN** `decision` SHALL be available to that agent

### Requirement: Input validation
The `decision` tool SHALL validate that `state` and `questions` are present before sending the request.

#### Scenario: Missing state
- **WHEN** an agent invokes the `decision` tool without a `state`
- **THEN** the tool SHALL return an error

#### Scenario: Missing questions
- **WHEN** an agent invokes the `decision` tool without a `questions` record
- **THEN** the tool SHALL return an error

### Requirement: Config schema
The `agent.decision` config block SHALL be preserved by the config schema so zod does not strip it.

#### Scenario: Decision config preserved
- **WHEN** `config.yaml` contains an `agent.decision` block with `baseUrl`, `model`, and `temperature`
- **THEN** the resolved config SHALL retain the `agent.decision` block

#### Scenario: Default values
- **WHEN** `agent.decision` is not present in `config.yaml`
- **THEN** the resolved config SHALL default `baseUrl` to `""`, `model` to `"tev1:4b"`, and `temperature` to `0`

### Requirement: Decision config threaded at invoke time
The `decision` tool SHALL receive the configured `decisionConfig` at invoke time so it uses the configured `agent.decision.baseUrl` instead of failing with a "not configured" error.

#### Scenario: Configured decision config is used
- **WHEN** the `decision` tool is registered with `agent.decision.baseUrl` set and is invoked
- **THEN** `decisionImpl` SHALL receive a populated `decisionConfig` and SHALL call the configured Ollama `/v1/systemone` endpoint

#### Scenario: Decision config not threaded
- **WHEN** the `decision` tool is registered but `decisionConfig` is not threaded through at invoke time
- **THEN** `decisionImpl` SHALL NOT return a misleading "not configured" error when `agent.decision.baseUrl` is set

