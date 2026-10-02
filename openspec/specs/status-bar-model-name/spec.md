# status-bar-model-name Specification

## Purpose
TBD - created by archiving change status-bar-model-name. Update Purpose after archive.
## Requirements
### Requirement: Status bar displays the active model name
The system SHALL display the active provider model name in the status bar's right-hand box, rendered as `[🧠 <model>]`, positioned to the right of the token display and before or around the version. The model name SHALL be derived from the active provider configuration. The display SHALL be omitted when no model is configured.

#### Scenario: Status bar displays the model name when configured
- **WHEN** a provider model is configured
- **THEN** the status bar renders `[🧠 <model>]` in the right-hand box

#### Scenario: Status bar omits the model name when not configured
- **WHEN** no provider model is configured
- **THEN** the status bar does not render the model display

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

