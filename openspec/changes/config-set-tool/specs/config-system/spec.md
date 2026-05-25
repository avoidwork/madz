## MODIFIED Requirements

### Requirement: Runtime Config Mutation
The system SHALL provide a dedicated config mutator tool (`src/config/mutate.js`) that deserializes `config.yaml`, applies dot-path mutations, validates via zod, serializes back to YAML, and persists to disk — enabling dynamic adjustment of sandbox parameters, memory policies, skill permissions, and provider assignments without restarting the harness. Mutation is exposed to the TUI via `:config set <path> <value>` which calls the mutator through `config.setValue`.

#### Scenario: User changes temperature at runtime
- **WHEN** the user types `:config set inference.temperature 0.7`
- **THEN** the config mutator updates the in-memory config, validates via zod, persists the change to `config.yaml`, and applies it to active provider invocations

#### Scenario: User pauses a skill at runtime
- **WHEN** the user types `:config set skills.<name>.disabled true`
- **THEN** the config mutator updates the in-memory config, persists the change to `config.yaml`, and the skill is removed from the active registry without restarting
