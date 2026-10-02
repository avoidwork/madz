# status-bar-model-name Specification

## MODIFIED Requirements

### Requirement: Active model name derived from provider config
The system SHALL derive the active model name from the first enabled provider, falling back to `openai` when no provider is enabled. The provider-selection logic SHALL be shared between the orchestrator and the status bar so the rule is not duplicated.

#### Scenario: Model name comes from the first enabled provider
- **WHEN** `config.providers` has a provider configured with a model and `enabled !== false`
- **THEN** the active model name is that provider's `model` value

#### Scenario: Disabled first provider is skipped
- **WHEN** the first provider in `config.providers` has `enabled: false` and a later provider is enabled
- **THEN** the active model name comes from the later enabled provider

#### Scenario: Falls back to openai when no provider enabled
- **WHEN** no provider in `config.providers` is enabled
- **THEN** the active model name falls back to the `openai` provider's model (or empty if not present)
