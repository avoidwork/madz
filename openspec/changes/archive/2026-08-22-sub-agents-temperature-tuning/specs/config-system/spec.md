## Purpose

Extend the configuration system to support per-agent temperature tuning via a new `subAgentsTemperature` config section.

## MODIFIED Requirements

### Requirement: Configuration Loading and Validation
The system SHALL load all configuration from `config.yaml` via `src/config/loader.js`, validate it against Zod schemas in `src/config/schemas.js`, and make it available to all subsystems through the `settings` singleton. The config MUST include a `persistence` section at the top level for configuring LangGraph checkpoint persistence with `mode` (string, default: `"memory"`) and optional `sqlite_path` (string, default: `"memory/checkpoints.db"`). The config MUST include a `subAgentsTemperature` section at the top level as a record mapping agent name strings to temperature numbers in the range [0, 2], defaulting to an empty object `{}`.

#### Scenario: Configuration is loaded from YAML file
- **WHEN** the application starts and reads `config.yaml`
- **THEN** all defined sections (`providers`, `memory`, `session`, `sandbox`, `skills`, `telemetry`, `tui`, `persistence`) are loaded and validated

#### Scenario: Persistence defaults apply
- **WHEN** `config.yaml` has no `persistence` section or `persistence.mode` is absent
- **THEN** the system defaults `mode` to `"memory"` and `sqlite_path` to `"memory/checkpoints.db"`

#### Scenario: Persistence mode validation
- **WHEN** `config.yaml` sets `persistence.mode` to an unsupported value (e.g., `"redis"`)
- **THEN** the application logs a warning and falls back to `"memory"` mode

#### Scenario: subAgentsTemperature defaults to empty object
- **WHEN** `config.yaml` has no `subAgentsTemperature` section
- **THEN** the system defaults `subAgentsTemperature` to an empty object `{}`

#### Scenario: subAgentsTemperature validation rejects invalid values
- **WHEN** `config.yaml` sets `subAgentsTemperature.coding` to a value outside 0–2 range
- **THEN** the application logs a validation error and rejects the configuration