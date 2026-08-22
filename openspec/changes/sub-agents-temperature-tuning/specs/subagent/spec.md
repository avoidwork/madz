## MODIFIED Requirements

### Requirement: Sub-agent tool spawns child processes
The subAgent tool SHALL spawn `node index.js "PROMPT" sessionsDir` as an independent child process, inheriting the parent's environment variables while maintaining session isolation. Skills assigned to sub-agents via `metadata.agent` (either from frontmatter or `skillAgentMap` config) SHALL be loaded and passed to the sub-agent's context. When `subAgentsTemperature` config is set, the sub-agent's model SHALL be created with a per-agent temperature override derived from `config.subAgentsTemperature[agentName]`.

#### Scenario: Single execution spawns process
- **WHEN** user calls subAgent with a delegation instruction and context
- **THEN** the tool spawns a node process with the constructed prompt and returns a structured result

#### Scenario: Process inherits environment
- **WHEN** a sub-agent is spawned
- **THEN** it inherits the parent process's environment variables (API keys, config paths)

#### Scenario: Sub-agent receives skills with injected metadata.agent
- **WHEN** a skill is assigned to a sub-agent via `skillAgentMap` config pattern
- **THEN** the skill's `metadata.agent` is injected before routing and the sub-agent receives the skill in its context

#### Scenario: Sub-agent uses per-agent temperature from config
- **WHEN** `subAgentsTemperature.coding` is set to `0.3` in config.yaml
- **THEN** the coding sub-agent's model is created with `temperature: 0.3`

#### Scenario: Sub-agent without config uses provider default
- **WHEN** an agent name is not listed in `subAgentsTemperature`
- **THEN** the model is created with the provider-level default temperature (undefined, letting the model use its own default)