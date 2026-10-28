## MODIFIED Requirements

### Requirement: Provider config has an enabled boolean
The system SHALL support an `enabled` boolean field on `OpenaiProviderConfigSchema`, `CopilotProviderConfigSchema`, and `BedrockProviderConfigSchema` in `src/config/schemas/providers.js`, defaulting to `true`.

#### Scenario: enabled defaults to true
- **WHEN** a provider config is validated without an `enabled` field
- **THEN** the schema applies the default value of `true`

#### Scenario: enabled accepts false
- **WHEN** a provider config sets `enabled: false`
- **THEN** the schema validates successfully and preserves `false`

#### Scenario: enabled rejects non-boolean
- **WHEN** a provider config sets `enabled: "yes"`
- **THEN** the schema rejects the value with a validation error

#### Scenario: Bedrock enabled defaults to true
- **WHEN** a `bedrock` provider config is validated without an `enabled` field
- **THEN** the `BedrockProviderConfigSchema` applies the default value of `true`
