## MODIFIED Requirements

### Requirement: Configuration Loading and Validation
The system SHALL load all configuration from `config.yaml` via `src/config/loader.js`, validate it against Zod schemas in `src/config/schemas.js`, and make it available to all subsystems through the `settings` singleton. The config MUST include a `persistence` section at the top level for configuring LangGraph checkpoint persistence with `mode` (string, default: `"memory"`) and optional `sqlite_path` (string, default: `"memory/checkpoints.db"`). The config MUST include a `subAgentsTemperature` section at the top level as a record mapping agent name strings to temperature numbers in the range [0, 2], defaulting to an empty object `{}`. The loading pipeline SHALL include a `syncEnv()` step between YAML parsing and env-var resolution that materializes missing config structure from environment variables.

#### Scenario: Configuration is loaded from YAML file
- **WHEN** the application starts and reads `config.yaml`
- **THEN** all defined sections (`providers`, `memory`, `session`, `sandbox`, `skills`, `telemetry`, `tui`, `persistence`) are loaded and validated

#### Scenario: syncEnv materializes missing structure before env-var resolution
- **WHEN** `config.yaml` does not define a `vector.projects.myProject` section but env vars like `VECTOR_PROJECTS_MYPROJECT_ROOT_DIR` and `VECTOR_PROJECTS_MYPROJECT_DB_PATH` are set
- **THEN** `syncEnv()` creates the missing structure in the raw config object before `_resolveEnvRecursively()` resolves the leaf values

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

## ADDED Requirements

### Requirement: Environment variable config materialization
The system SHALL materialize missing config structure from environment variables when the corresponding YAML path does not exist in `config.yaml`, enabling full configuration via environment variables without editing YAML files. See `specs/env-config-materialization/spec.md` for detailed requirements.
