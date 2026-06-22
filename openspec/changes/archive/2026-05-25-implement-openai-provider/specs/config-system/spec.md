## MODIFIED Requirements

### Requirement: LLM Provider Configuration
The system SHALL support configuration of multiple LLM providers including OpenAI-compatible APIs, local model deployments, and custom cloud endpoints, each specifying base URL, model identifier, authentication, rate limits, temperature, and fallback routing. The provider client SHALL read and apply all resolved configuration values (`base_url`, `model`, `credentials.apiKey`, `temperature`, `maxTokens`) from `config.providers[name]` to initialize the LLM client.

#### Scenario: User configures an OpenAI-compatible provider
- **WHEN** `config.yaml` contains a provider entry with `type: openai`
- **THEN** the system initializes the provider client using the resolved `base_url`, `model`, `credentials.apiKey`, `temperature`, and `maxTokens` values from `config.providers[name]`

#### Scenario: Provider falls back to second provider on failure
- **WHEN** the primary configured provider returns a consistent error
- **THEN** the system switches to the next provider listed in `fallback_order`

#### Scenario: Provider uses per-provider config values
- **WHEN** `config.yaml` defines `providers.openai.model: "gpt-4o"` and `providers.openai.temperature: 0.7`
- **THEN** the `ChatOpenAI` client is created with `model: "gpt-4o"` and `temperature: 0.7`
- **THEN** the provider client in `src/provider/openai.js` reads these values from the resolved config object, not from hardcoded or default values
