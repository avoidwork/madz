# provider-enabled-flag Specification

## Purpose
TBD - created by archiving change provider-enabled-flag. Update Purpose after archive.
## Requirements
### Requirement: Provider config has an enabled boolean
The system SHALL support an `enabled` boolean field on both `OpenaiProviderConfigSchema` and `CopilotProviderConfigSchema` in `src/config/schemas/providers.js`, defaulting to `true`.

#### Scenario: enabled defaults to true
- **WHEN** a provider config is validated without an `enabled` field
- **THEN** the schema applies the default value of `true`

#### Scenario: enabled accepts false
- **WHEN** a provider config sets `enabled: false`
- **THEN** the schema validates successfully and preserves `false`

#### Scenario: enabled rejects non-boolean
- **WHEN** a provider config sets `enabled: "yes"`
- **THEN** the schema rejects the value with a validation error

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

### Requirement: Copilot detection respects the enabled-based active provider
The system SHALL determine Copilot behavior from the resolved active provider's `type` rather than relying solely on config position or a hardcoded provider name.

#### Scenario: createChatModel detects copilot from resolved provider
- **WHEN** the active provider config has `type: "github-copilot"`
- **THEN** `createChatModel` configures the Copilot fetch interceptor and omits `apiKey`

#### Scenario: TUI copilot guard keys off resolved provider
- **WHEN** the resolved active provider has `type: "github-copilot"`
- **THEN** the TUI registers the Copilot 401 re-auth handler

