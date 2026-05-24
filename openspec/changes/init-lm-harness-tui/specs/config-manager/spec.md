## ADDED Requirements

### Requirement: Centralized YAML configuration
The system SHALL load all configuration from a single `config.yaml` file in the project root on startup.

#### Scenario: Config loaded on startup
- **WHEN** the application starts
- **THEN** the system reads `config.yaml`, parses it, validates structure, and initializes all subsystems from the configuration values

#### Scenario: Missing config creates defaults
- **WHEN** `config.yaml` does not exist at startup
- **THEN** the system creates a `config.yaml` with secure, opinionated defaults and logs the creation

#### Scenario: Invalid config rejected
- **WHEN** `config.yaml` contains syntax errors or invalid values
- **THEN** the system rejects the file with a descriptive error and falls back to defaults only if a `.config.yaml.bak` exists

### Requirement: Provider configuration schema
The system SHALL support structured provider configuration entries including base URLs, model identifiers, authentication credentials, rate limits, temperature settings, and fallback routing.

#### Scenario: Provider entry defined
- **WHEN** a provider is defined in `config.yaml.providers` with required fields (`name`, `type`, `model`, `apiKey` or `base`)
- **THEN** the provider registry registers it and makes it available for selection

#### Scenario: Fallback chain defined
- **WHEN** a provider entry includes a `fallback` array with other provider names
- **THEN** the adapter factory chains those providers in order during failover

#### Scenario: Environment variable interpolation
- **WHEN** a configuration value contains an environment variable reference (`${ENV_VAR}`)
- **THEN** the `ConfigManager` resolves the reference at read time using `process.env`

### Requirement: Runtime configuration modification
The system SHALL allow configuration values to be modified at runtime without requiring a restart.

#### Scenario: Config modified via command
- **WHEN** the user types `/config <key> <value>` in the TUI
- **THEN** the system updates the in-memory config, writes the change to `config.yaml`, and emits a config change event

#### Scenario: Config change propagates
- **WHEN** a configuration value changes at runtime
- **THEN** all subscribers (sandbox, scheduler, telemetry) receive the change event and react accordingly

#### Scenario: Atomic config save
- **WHEN** the system writes a configuration change to `config.yaml`
- **THEN** it uses atomic rename (write to temp, then `fs.rename`) to prevent partial writes

### Requirement: Sandbox configuration
The system SHALL support sandbox parameter configuration including filesystem mount rules, network policies, resource limits, and container image settings.

#### Scenario: Default sandbox mounts defined
- **WHEN** the application starts with default sandbox config
- **THEN** it binds-mounts `memory/` as read-write and `config.yaml` as read-only inside the container

#### Scenario: Custom resource limits applied
- **WHEN** `config.yaml` defines `sandbox.resources.cpu` and `sandbox.resources.memory`
- **THEN** the Docker container is created with those resource constraints applied

### Requirement: Telemetry configuration
The system SHALL support OTEL configuration in `config.yaml` including export endpoints, sampling rates, export formats, and data redaction policies.

#### Scenario: OTEL endpoint configured
- **WHEN** `config.yaml.telemetry` defines an `endpoint` and `protocol`
- **THEN** the system initializes the OpenTelemetry SDK with the specified exporter and protocol

#### Scenario: Sensitive data redacted
- **WHEN** the telemetry configuration defines a `redaction` list of key patterns
- **THEN** the OTEL processor strips or masks values matching those patterns before export

### Requirement: Scheduler configuration
The system SHALL support cron-based schedule definitions in `config.yaml.schedules` mapping expressions to skill invocations.

#### Scenario: Schedule entry defined
- **WHEN** `config.yaml.schedules` includes an entry with a cron expression and skill name
- **THEN** the scheduler registers the entry and begins tracking the next trigger time

#### Scenario: Schedule activated on time
- **WHEN** the current time matches a schedule's cron expression
- **THEN** the scheduler invokes the configured skill with the specified memory context and logs the result
