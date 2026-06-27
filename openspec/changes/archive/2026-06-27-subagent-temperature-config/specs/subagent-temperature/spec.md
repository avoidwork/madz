## ADDED Requirements

### Requirement: SubAgent temperature is configurable in config.yaml
The system SHALL allow users to configure the temperature parameter for subAgents via the `process.subAgent.temperature` field in config.yaml. The default value SHALL be 0.7. The temperature value MUST be a number between 0 and 2 (inclusive), following OpenAI's API specification.

#### Scenario: Default temperature is used when not configured
- **WHEN** config.yaml does not contain `process.subAgent.temperature`
- **THEN** the system uses the default temperature value of 0.7

#### Scenario: Custom temperature is read from config
- **WHEN** config.yaml contains `process.subAgent.temperature: 0.3`
- **THEN** the system uses the configured temperature value of 0.3 for subAgents

#### Scenario: Invalid temperature is rejected
- **WHEN** config.yaml contains `process.subAgent.temperature: 3`
- **THEN** the system rejects the configuration with a validation error

#### Scenario: Negative temperature is rejected
- **WHEN** config.yaml contains `process.subAgent.temperature: -0.5`
- **THEN** the system rejects the configuration with a validation error

### Requirement: Temperature is passed to spawned subAgent process
The system SHALL pass the temperature value to spawned subAgent processes via the `MADZ_SUBAGENT_TEMPERATURE` environment variable. The `spawnSubAgentProcess()` function in `src/tools/subAgent.js` SHALL read the temperature from config and inject it into the child process environment.

#### Scenario: Temperature is passed via environment variable
- **WHEN** a subAgent is spawned with temperature 0.5
- **THEN** the spawned process receives `MADZ_SUBAGENT_TEMPERATURE=0.5` in its environment

#### Scenario: Default temperature is passed when not configured
- **WHEN** a subAgent is spawned without a configured temperature
- **THEN** the spawned process receives `MADZ_SUBAGENT_TEMPERATURE=0.7` in its environment

### Requirement: Spawned process overrides provider temperature
The system SHALL override the provider temperature in spawned processes when `MADZ_SUBAGENT_TEMPERATURE` is set. The `createChatModel()` function in `src/provider/openai.js` SHALL check for the env var and use it to override the provider's temperature.

#### Scenario: Spawned process uses env var temperature
- **WHEN** `MADZ_SUBAGENT_TEMPERATURE=0.3` is set in the spawned process
- **THEN** the ChatOpenAI model is created with temperature 0.3

#### Scenario: Spawned process falls back to config when env var not set
- **WHEN** `MADZ_SUBAGENT_TEMPERATURE` is not set in the spawned process
- **THEN** the spawned process uses the config default temperature of 0.7

### Requirement: Per-call temperature override in subAgent tool
The system SHALL allow per-call temperature overrides via an optional `temperature` parameter in the subAgent tool schema. Per-call temperature takes precedence over the env var and config default, following the resolution hierarchy: per-call > env var > config default > provider default.

#### Scenario: Per-call temperature overrides config
- **WHEN** a subAgent is called with `temperature: 0.9` and config has `0.5`
- **THEN** the spawned process uses temperature 0.9

#### Scenario: Per-call temperature overrides env var
- **WHEN** a subAgent is called with `temperature: 0.2` and env var is `0.7`
- **THEN** the spawned process uses temperature 0.2

#### Scenario: No per-call temperature uses default resolution
- **WHEN** a subAgent is called without a temperature parameter
- **THEN** the spawned process uses the config default temperature of 0.7

#### Scenario: Invalid per-call temperature is rejected
- **WHEN** a subAgent is called with `temperature: 5` (out of range)
- **THEN** the system rejects the call with a validation error

### Requirement: Main process temperature is not affected
The system SHALL NOT modify the main process temperature when spawning subAgents with different temperatures. Each spawned process operates independently with its own temperature setting.

#### Scenario: Main process temperature remains unchanged
- **WHEN** a subAgent is spawned with temperature 0.3
- **THEN** the main process continues to use its original temperature setting