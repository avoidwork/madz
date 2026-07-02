## MODIFIED Requirements

### Requirement: Config removes process subAgent settings
The system SHALL remove process-based subAgent configuration from config.yaml.

#### Scenario: Process subAgent config is removed
- **WHEN** config.yaml is loaded
- **THEN** timeout, maxConcurrent, sessionMode, defaultStrategy, defaultOnError, and temperature process subAgent settings are not present

#### Scenario: Turn hash tracking config is removed
- **WHEN** config.yaml is loaded
- **THEN** turnHashWindow and turnBufferMax settings are not present

### Requirement: Config includes Deep Agents settings
The system SHALL include Deep Agents configuration in config.yaml.

#### Scenario: Deep Agents configuration is loaded
- **WHEN** config.yaml is loaded
- **THEN** Deep Agents settings (agent routing, temperature, etc.) are available

### Requirement: SUB_AGENT_TEMPERATURE handled via Deep Agents
The system SHALL handle sub-agent temperature via Deep Agents configuration instead of src/provider/openai.js env var.

#### Scenario: Sub-agent temperature is configured
- **WHEN** a sub-agent is invoked
- **THEN** the temperature is set via Deep Agents configuration, not SUB_AGENT_TEMPERATURE env var