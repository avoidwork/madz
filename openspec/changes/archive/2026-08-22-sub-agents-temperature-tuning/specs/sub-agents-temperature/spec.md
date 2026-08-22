## ADDED Requirements

### Requirement: Sub-agent temperature configuration schema
The system SHALL define a Zod schema (SubAgentsTemperatureSchema) that validates a record mapping agent name strings to temperature numbers in the range [0, 2].

#### Scenario: Valid temperature values are accepted
- **WHEN** a config contains `subAgentsTemperature: { coding: 0.3, research: 0.5 }`
- **THEN** the schema validates successfully

#### Scenario: Out-of-range temperature values are rejected
- **WHEN** a config contains `subAgentsTemperature: { coding: -0.1 }` or `subAgentsTemperature: { coding: 2.1 }`
- **THEN** the schema validation fails with a type error

#### Scenario: Non-numeric temperature values are rejected
- **WHEN** a config contains `subAgentsTemperature: { coding: "0.3" }`
- **THEN** the schema validation fails with a type error

#### Scenario: Empty config is accepted
- **WHEN** a config contains `subAgentsTemperature: {}`
- **THEN** the schema validates successfully

### Requirement: Environment variable resolution for sub-agent temperatures
The system SHALL resolve environment variables to populate sub-agent temperature config values. The env var naming convention is: `SUB_AGENTS_TEMPERATURE_<AGENT_NAME>` where agent names with hyphens are converted to underscores (e.g., `code-review` → `SUB_AGENTS_TEMPERATURE_CODE_REVIEW`).

#### Scenario: Environment variable populates agent temperature
- **WHEN** `SUB_AGENTS_TEMPERATURE_CODING=0.3` is set and config.yaml omits `subAgentsTemperature.coding`
- **THEN** the resolved config has `subAgentsTemperature.coding` equal to `0.3`

#### Scenario: Hyphenated agent name env var resolves correctly
- **WHEN** `SUB_AGENTS_TEMPERATURE_CODE_REVIEW=0.1` is set
- **THEN** the resolved config has `subAgentsTemperature["code-review"]` equal to `0.1`

#### Scenario: Non-numeric environment variable value is rejected
- **WHEN** `SUB_AGENTS_TEMPERATURE_CODING=abc` is set
- **THEN** the loader parses it as a string and the schema validation fails

### Requirement: Sub-agent temperature accessor function
The system SHALL export a `getSubAgentTemperature(agentName)` function that reads from the resolved config and returns the temperature for the given agent name, or `undefined` if not configured.

#### Scenario: Existing agent returns configured temperature
- **WHEN** `getSubAgentTemperature('coding')` is called and `subAgentsTemperature.coding` is `0.3`
- **THEN** the function returns `0.3`

#### Scenario: Missing agent returns undefined
- **WHEN** `getSubAgentTemperature('unknown-agent')` is called and the agent is not configured
- **THEN** the function returns `undefined`

#### Scenario: Empty agent name returns undefined
- **WHEN** `getSubAgentTemperature('')` is called
- **THEN** the function returns `undefined`