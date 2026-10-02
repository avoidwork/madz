# config-system Specification

## MODIFIED Requirements

### Requirement: LLM Provider Configuration
The system SHALL support configuration of multiple LLM providers including OpenAI-compatible APIs, local model deployments, and custom cloud endpoints, each specifying base URL, model identifier, authentication, rate limits, temperature, and fallback routing. Each provider config SHALL include an `enabled` boolean field defaulting to `true`, and the active provider SHALL be the first provider whose `enabled !== false`. The `maxTokens` provider setting SHALL allow `-1` (unlimited / no cap) and SHALL default to `-1`.

#### Scenario: User configures an OpenAI-compatible provider
- **WHEN** `config.yaml` contains a provider entry with `type: openai`
- **THEN** the system initializes the provider client using the specified base URL and model

#### Scenario: Provider falls back to second provider on failure
- **WHEN** the primary configured provider returns a consistent error
- **THEN** the system switches to the next provider listed in `fallback_order`

#### Scenario: maxTokens defaults to -1 (unlimited)
- **WHEN** a provider entry omits `maxTokens`
- **THEN** the schema applies the default value of `-1`

#### Scenario: maxTokens accepts -1
- **WHEN** a provider entry sets `maxTokens: -1`
- **THEN** the schema accepts the value (no positive-integer constraint violation)

#### Scenario: maxTokens rejects a value below -1
- **WHEN** a provider entry sets `maxTokens: -2`
- **THEN** the schema rejects the value with a validation error

#### Scenario: Provider enabled defaults to true
- **WHEN** a provider entry omits `enabled`
- **THEN** the schema applies the default value of `true`

#### Scenario: Active provider is the first enabled provider
- **WHEN** `config.providers` has multiple providers and the first is disabled while a later one is enabled
- **THEN** the system selects the first enabled provider as active
