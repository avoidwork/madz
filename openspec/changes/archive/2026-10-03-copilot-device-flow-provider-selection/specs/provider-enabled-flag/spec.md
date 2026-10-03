## MODIFIED Requirements

### Requirement: Active provider selected by enabled flag
The system SHALL select the active provider as the first provider in `config.providers` whose `enabled !== false`, falling back to `openai` when no provider is enabled. This selection rule SHALL be shared across the orchestrator, model factory, TUI, and the init-time auth flow via `getActiveProviderConfig`.

#### Scenario: First enabled provider is selected
- **WHEN** `config.providers` has multiple providers and the first is disabled while a later one is enabled
- **THEN** `getActiveProviderConfig` returns the first enabled provider

#### Scenario: Disabled first provider is skipped
- **WHEN** the first provider in `config.providers` has `enabled: false`
- **THEN** `getActiveProviderConfig` skips it and selects the next enabled provider

#### Scenario: All providers disabled falls back to openai
- **WHEN** all providers in `config.providers` have `enabled: false`
- **THEN** `getActiveProviderConfig` falls back to the `openai` provider (or an empty object if absent)

#### Scenario: No providers configured returns empty object
- **WHEN** `config.providers` is empty or absent
- **THEN** `getActiveProviderConfig` returns an empty object

#### Scenario: Init-time auth flow uses enabled-based selection
- **WHEN** the startup auth check in `index.js` resolves the active provider
- **THEN** it uses `getActiveProviderName(config)` so the Copilot device flow triggers whenever Copilot is the enabled provider, regardless of config position

#### Scenario: Copilot enabled but not first triggers device flow
- **WHEN** `config.providers` lists `openai` first with `enabled: false` and `copilot` second with `enabled: true`
- **THEN** the init-time auth check selects `copilot` and triggers the OAuth device flow
