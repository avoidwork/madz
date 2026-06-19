## Purpose

The config-system capability defines how the application loads, validates, and manages configuration from `config.yaml`. It provides a centralized, validated configuration mechanism that supports multiple LLM providers, runtime mutation, and persistence settings.
## Requirements
### Requirement: Centralized Configuration File
The system SHALL load all configuration from a single `config.yaml` file located in the project root directory using YAML parsing.

#### Scenario: System loads config.yaml on startup
- **WHEN** the harness starts
- **THEN** it reads and parses `config.yaml`, merging defaults for any missing sections

#### Scenario: Missing required config fields use defaults
- **WHEN** `config.yaml` omits an optional field such as `telemetry.sampling.ratio`
- **THEN** the system applies the documented default value

### Requirement: LLM Provider Configuration
The system SHALL support configuration of multiple LLM providers including OpenAI-compatible APIs, local model deployments, and custom cloud endpoints, each specifying base URL, model identifier, authentication, rate limits, temperature, and fallback routing.

#### Scenario: User configures an OpenAI-compatible provider
- **WHEN** `config.yaml` contains a provider entry with `type: openai`
- **THEN** the system initializes the provider client using the specified base URL and model

#### Scenario: Provider falls back to second provider on failure
- **WHEN** the primary configured provider returns a consistent error
- **THEN** the system switches to the next provider listed in `fallback_order`

### Requirement: Configuration Validation
The system SHALL validate all `config.yaml` contents against a zod-based schema on boot and on runtime mutation, rejecting invalid configurations with a structured error message.

#### Scenario: Invalid provider config is rejected
- **WHEN** a provider entry is missing a `base_url` field
- **THEN** the system logs a validation error and refuses to initialize that provider

#### Scenario: Runtime config mutation is validated
- **WHEN** the user sets a config value via TUI command (`:config set`)
- **THEN** the system validates the new value against the schema before applying it

### Requirement: Configuration Loading and Validation
The system SHALL load all configuration from `config.yaml` via `src/config/loader.js`, validate it against Zod schemas in `src/config/schemas.js`, and make it available to all subsystems through the `settings` singleton. The config MUST include a `persistence` section at the top level for configuring LangGraph checkpoint persistence with `mode` (string, default: `"memory"`) and optional `sqlite_path` (string, default: `"memory/checkpoints.db"`).

#### Scenario: Configuration is loaded from YAML file
- **WHEN** the application starts and reads `config.yaml`
- **THEN** all defined sections (`providers`, `memory`, `session`, `sandbox`, `skills`, `telemetry`, `tui`, `persistence`) are loaded and validated

#### Scenario: Persistence defaults apply
- **WHEN** `config.yaml` has no `persistence` section or `persistence.mode` is absent
- **THEN** the system defaults `mode` to `"memory"` and `sqlite_path` to `"memory/checkpoints.db"`

#### Scenario: Persistence mode validation
- **WHEN** `config.yaml` sets `persistence.mode` to an unsupported value (e.g., `"redis"`)
- **THEN** the application logs a warning and falls back to `"memory"` mode

### Requirement: Runtime Config Mutation
The system SHALL provide a dedicated config mutator tool (`src/config/mutate.js`) that deserializes `config.yaml`, applies dot-path mutations, validates via zod, serializes back to YAML, and persists to disk — enabling dynamic adjustment of sandbox parameters, memory policies, skill permissions, and provider assignments without restarting the harness. Mutation is exposed to the TUI via `:config set <path> <value>` which calls the mutator through `config.setValue`.

#### Scenario: User changes temperature at runtime
- **WHEN** the user types `:config set inference.temperature 0.7`
- **THEN** the config mutator updates the in-memory config, validates via zod, persists the change to `config.yaml`, and applies it to active provider invocations

#### Scenario: User pauses a skill at runtime
- **WHEN** the user types `:config set skills.<name>.disabled true`
- **THEN** the config mutator updates the in-memory config, persists the change to `config.yaml`, and the skill is removed from the active registry without restarting

### Requirement: Telemetry Configuration
The system SHALL configure OpenTelemetry export settings (format, endpoint, sampling rate, redaction policies) within `config.yaml` under a `telemetry` section.

#### Scenario: User configures OTEL console exporter
- **WHEN** `config.yaml` sets `telemetry.exporter: console`
- **THEN** the system initializes the trace provider with a console exporter and begins emitting spans

#### Scenario: User configures sensitive field redaction
- **WHEN** `config.yaml` sets `telemetry.redact.paths` to include `credentials.apiKey`
- **THEN** all span attributes matching the path are redacted before export

### Requirement: Secure YAML Parsing
The system SHALL use safe YAML parsing (`yaml.safeLoad()`) when loading `config.yaml` to prevent arbitrary code execution via malicious YAML tags (e.g., `!!js/function`).

#### Scenario: Malicious YAML tag is rejected
- **WHEN** `config.yaml` contains a malicious YAML tag (e.g., `!!js/function`)
- **THEN** the system rejects the tag and does not execute arbitrary code

#### Scenario: Safe YAML parsing is used
- **WHEN** the application loads `config.yaml`
- **THEN** it uses `yaml.safeLoad()` instead of `yaml.load()` for safe parsing

#### Scenario: Standard YAML types are parsed correctly
- **WHEN** `config.yaml` contains standard YAML types (strings, numbers, booleans, arrays, objects)
- **THEN** the system parses them correctly without errors

