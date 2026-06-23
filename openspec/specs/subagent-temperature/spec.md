# subagent-temperature Specification

## Purpose
TBD - created by archiving change subagent-temperature-config. Update Purpose after archive.
## Requirements
### Requirement: Global subAgent temperature configuration
The system SHALL allow users to configure a global default temperature for all subAgents via `process.subAgent.temperature` in config.yaml. Temperature values MUST be floats in the range 0-2 (OpenAI specification). When not configured, subAgents SHALL use the provider default temperature.

#### Scenario: Valid global temperature is accepted
- **WHEN** config.yaml contains `process.subAgent.temperature: 0.7`
- **THEN** the system accepts the value and uses it as the default for all subAgents

#### Scenario: Global temperature at minimum boundary
- **WHEN** config.yaml contains `process.subAgent.temperature: 0`
- **THEN** the system accepts the value and uses deterministic (non-random) outputs

#### Scenario: Global temperature at maximum boundary
- **WHEN** config.yaml contains `process.subAgent.temperature: 2`
- **THEN** the system accepts the value and uses maximum randomness

#### Scenario: Global temperature outside valid range is rejected
- **WHEN** config.yaml contains `process.subAgent.temperature: -0.1` or `process.subAgent.temperature: 2.1`
- **THEN** the system rejects the value with a validation error

#### Scenario: Missing global temperature uses provider default
- **WHEN** config.yaml does not contain `process.subAgent.temperature`
- **THEN** subAgents use the provider default temperature from `providers.openai.temperature`

### Requirement: Per-skill temperature override
The system SHALL allow users to configure a temperature override for specific skills via `process.subAgent.skills[].temperature` in config.yaml. Per-skill temperature MUST take precedence over the global default.

#### Scenario: Per-skill temperature overrides global default
- **WHEN** config.yaml contains global `temperature: 0.7` and skill-specific `temperature: 0.3` for audit-code
- **THEN** audit-code subAgents use 0.3 while other skills use 0.7

#### Scenario: Per-skill temperature without global default
- **WHEN** config.yaml contains only skill-specific `temperature: 0.3` without global temperature
- **THEN** the skill uses 0.3 and other skills use provider default

### Requirement: Temperature passed to spawned process via environment variable
The system SHALL pass the resolved temperature value to spawned subAgent processes via the `MADZ_SUBAGENT_TEMPERATURE` environment variable. The env var MUST only be set when temperature is explicitly configured (not when using provider default).

#### Scenario: Temperature env var is set when configured
- **WHEN** config.yaml contains `process.subAgent.temperature: 0.5`
- **THEN** the spawned subAgent process receives `MADZ_SUBAGENT_TEMPERATURE=0.5`

#### Scenario: Temperature env var is not set when using provider default
- **WHEN** config.yaml does not contain subAgent temperature configuration
- **THEN** the spawned subAgent process does not receive `MADZ_SUBAGENT_TEMPERATURE` env var

#### Scenario: Per-skill temperature env var overrides global
- **WHEN** config.yaml contains global `temperature: 0.7` and skill-specific `temperature: 0.3`
- **THEN** the audit-code subAgent receives `MADZ_SUBAGENT_TEMPERATURE=0.3`

### Requirement: Spawned process overrides provider temperature
The system SHALL override the provider temperature in spawned subAgent processes when `MADZ_SUBAGENT_TEMPERATURE` is set. Invalid env var values MUST fall back gracefully to the provider default.

#### Scenario: Spawned process uses env var temperature
- **WHEN** spawned process has `MADZ_SUBAGENT_TEMPERATURE=0.4`
- **THEN** the LLM call uses temperature 0.4 regardless of provider default

#### Scenario: Invalid env var falls back to provider default
- **WHEN** spawned process has `MADZ_SUBAGENT_TEMPERATURE=invalid`
- **THEN** the LLM call uses the provider default temperature

#### Scenario: Empty env var falls back to provider default
- **WHEN** spawned process has `MADZ_SUBAGENT_TEMPERATURE=` (empty string)
- **THEN** the LLM call uses the provider default temperature

#### Scenario: Parent process temperature unchanged
- **WHEN** spawned process has `MADZ_SUBAGENT_TEMPERATURE=0.4` and parent has provider temperature 0.7
- **THEN** parent process LLM calls continue using 0.7

### Requirement: Per-call temperature override
The system SHALL accept an optional `temperature` parameter in the subAgent tool invocation. Per-call temperature MUST take precedence over all config levels (per-skill, global, provider).

#### Scenario: Per-call temperature overrides all config
- **WHEN** subAgent is called with `temperature: 0.9` and config has global `0.7`
- **THEN** the subAgent uses temperature 0.9

#### Scenario: Per-call temperature validation
- **WHEN** subAgent is called with `temperature: 3.0` (out of range)
- **THEN** the system rejects the call with a validation error

#### Scenario: Per-call temperature without config
- **WHEN** subAgent is called with `temperature: 0.5` and no config temperature
- **THEN** the subAgent uses temperature 0.5

### Requirement: Resolution hierarchy
The system SHALL resolve temperature using the following priority order: per-call parameter > per-skill config > global config > provider default.

#### Scenario: Full resolution hierarchy
- **WHEN** per-call=0.9, per-skill=0.3, global=0.7, provider=0.5
- **THEN** resolved temperature is 0.9 (per-call wins)

#### Scenario: Fallback through hierarchy
- **WHEN** no per-call, per-skill=0.3, global=0.7, provider=0.5
- **THEN** resolved temperature is 0.3 (per-skill wins)

#### Scenario: Global fallback
- **WHEN** no per-call, no per-skill, global=0.7, provider=0.5
- **THEN** resolved temperature is 0.7 (global wins)

#### Scenario: Provider fallback
- **WHEN** no per-call, no per-skill, no global, provider=0.5
- **THEN** resolved temperature is 0.5 (provider default)

