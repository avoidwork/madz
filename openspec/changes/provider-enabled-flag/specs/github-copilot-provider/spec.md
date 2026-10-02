# github-copilot-provider Specification

## MODIFIED Requirements

### Requirement: GitHub Copilot provider configuration
The system SHALL support a `github-copilot` provider type in the config schema that does not require a static `credentials.apiKey`. The `CopilotProviderConfigSchema` SHALL include an `enabled` boolean field defaulting to `true`.

#### Scenario: Valid Copilot provider config
- **WHEN** a config declares `providers.github-copilot` with a `model` and no `credentials.apiKey`
- **THEN** the config validates successfully

#### Scenario: Missing model
- **WHEN** a `github-copilot` provider is declared without a `model`
- **THEN** config validation fails with a clear error

#### Scenario: Default base URL
- **WHEN** a `github-copilot` provider is declared without a `base_url`
- **THEN** the base URL defaults to `https://api.githubcopilot.com`

#### Scenario: Copilot enabled defaults to true
- **WHEN** a `github-copilot` provider config is validated without an `enabled` field
- **THEN** the schema applies the default value of `true`

#### Scenario: Copilot can be disabled
- **WHEN** a `github-copilot` provider config sets `enabled: false`
- **THEN** the schema validates successfully and preserves `false`
