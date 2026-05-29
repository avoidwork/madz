## MODIFIED Requirements

### Requirement: Configuration Loading and Validation
The system SHALL load all configuration from `config.yaml` via `src/config/loader.js`, validate it against Zod schemas in `src/config/schemas.js`, and make it available to all subsystems through the `settings` singleton. The config MUST include a `persistence` section at the top level for configuring LangGraph checkpoint persistence with `mode` (string, default: `"memory"`) and optional `sqlite_path` (string, default: `"memory/checkpoints.db"`).

#### Scenario: Configuration is loaded from YAML file
- **WHEN** the application starts and reads `config.yaml`
- **THEN** all defined sections (`providers`, `memory`, `session`, `sandbox`, `skills`, `telemetry`, `tui`, `schedules`, `persistence`) are loaded and validated

#### Scenario: Persistence defaults apply
- **WHEN** `config.yaml` has no `persistence` section or `persistence.mode` is absent
- **THEN** the system defaults `mode` to `"memory"` and `sqlite_path` to `"memory/checkpoints.db"`

#### Scenario: Persistence mode validation
- **WHEN** `config.yaml` sets `persistence.mode` to an unsupported value (e.g., `"redis"`)
- **THEN** the application logs a warning and falls back to `"memory"` mode
