## ADDED Requirements

### Requirement: Azure OpenAI provider configuration
The system SHALL support an `azure-openai` provider type in the config schema that does not require a static `credentials.apiKey`. The `AzureProviderConfigSchema` SHALL include an `enabled` boolean field defaulting to `true`, a `model` field (the deployment name), an optional `endpoint`, an optional `apiVersion`, `temperature`, `maxTokens`, `contextWindow`, `reasoning`, and `rateLimit`, and SHALL NOT include a `credentials` block.

#### Scenario: Valid Azure provider config
- **WHEN** a config declares `providers.azure` with `type: "azure-openai"` and a `model`
- **THEN** the config validates successfully

#### Scenario: Missing model
- **WHEN** an `azure-openai` provider is declared without a `model`
- **THEN** config validation fails with a clear error

#### Scenario: Azure enabled defaults to true
- **WHEN** an `azure-openai` provider config is validated without an `enabled` field
- **THEN** the schema applies the default value of `true`

#### Scenario: Azure can be disabled
- **WHEN** an `azure-openai` provider config sets `enabled: false`
- **THEN** the schema validates successfully and preserves `false`

#### Scenario: No credentials block
- **WHEN** an `azure-openai` provider config is validated
- **THEN** the schema does not require or accept a `credentials` block (the key comes from env)

#### Scenario: Endpoint must be https
- **WHEN** an `azure-openai` provider config specifies an `endpoint` that is not a valid `https` URL
- **THEN** config validation fails with a clear error

### Requirement: Azure provider factory builds AzureChatOpenAI
The system SHALL provide a factory that builds an `AzureChatOpenAI` instance for `type: "azure-openai"`, reading `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT` (or `AZURE_OPENAI_API_INSTANCE_NAME`), `AZURE_OPENAI_API_DEPLOYMENT_NAME`, and optional `AZURE_OPENAI_API_VERSION` from `process.env`.

#### Scenario: Factory returns AzureChatOpenAI
- **WHEN** `createAzureChatModel` is called with a valid `azure-openai` config and the required env vars are set
- **THEN** it returns an `AzureChatOpenAI` instance

#### Scenario: Endpoint resolved from AZURE_OPENAI_ENDPOINT
- **WHEN** `AZURE_OPENAI_ENDPOINT` is set
- **THEN** the factory uses it as the Azure endpoint

#### Scenario: Endpoint derived from AZURE_OPENAI_API_INSTANCE_NAME
- **WHEN** `AZURE_OPENAI_ENDPOINT` is unset but `AZURE_OPENAI_API_INSTANCE_NAME` is set
- **THEN** the factory derives the endpoint as `https://<instance>.openai.azure.com`

#### Scenario: Deployment name is the model
- **WHEN** the config `model` is set and `AZURE_OPENAI_API_DEPLOYMENT_NAME` is set
- **THEN** the factory uses the deployment name as the model

#### Scenario: Missing API key throws a clear error
- **WHEN** `AZURE_OPENAI_API_KEY` is unset
- **THEN** the factory throws an error naming `AZURE_OPENAI_API_KEY`

#### Scenario: Missing endpoint throws a clear error
- **WHEN** both `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_INSTANCE_NAME` are unset
- **THEN** the factory throws an error naming the missing variable

#### Scenario: Missing deployment name throws a clear error
- **WHEN** `AZURE_OPENAI_API_DEPLOYMENT_NAME` is unset
- **THEN** the factory throws an error naming `AZURE_OPENAI_API_DEPLOYMENT_NAME`

### Requirement: Azure provider is dispatched from createChatModel
The system SHALL route `type: "azure-openai"` to the Azure factory from `createChatModel`, so the orchestrator and subagents get the correct model without touching call sites.

#### Scenario: createChatModel dispatches Azure
- **WHEN** `createChatModel` is called with a config whose `type` is `"azure-openai"`
- **THEN** it returns an `AzureChatOpenAI` instance

#### Scenario: createChatModel preserves OpenAI behavior
- **WHEN** `createChatModel` is called with a config whose `type` is `"openai"`
- **THEN** it returns a `ChatOpenAI` instance

#### Scenario: createChatModel preserves Copilot behavior
- **WHEN** `createChatModel` is called with a config whose `type` is `"github-copilot"`
- **THEN** it returns a `ChatOpenAI` instance with the Copilot fetch interceptor

### Requirement: Azure provider does not fall into Copilot-only paths
The system SHALL ensure that an `azure-openai` provider does not trigger Copilot-only behavior in `deepAgents.js`, `modelInfo.js`, or `tui/app.js`.

#### Scenario: Azure does not trigger Copilot model resolution
- **WHEN** the active provider type is `azure-openai`
- **THEN** `deepAgents.js` does not call `resolveCopilotModel`

#### Scenario: Azure does not trigger Copilot retry middleware
- **WHEN** the active provider type is `azure-openai`
- **THEN** the Copilot 403 retry middleware is not registered

#### Scenario: Azure context length falls back to config
- **WHEN** `getModelContextLength` is called with an `azure-openai` provider config
- **THEN** it falls back to the configured `contextWindow` rather than probing a `/models` endpoint

#### Scenario: Azure does not trigger Copilot 401 re-auth
- **WHEN** the active provider type is `azure-openai`
- **THEN** the TUI does not register the Copilot 401 re-auth handler

### Requirement: Azure provider validates inputs with a Zod schema
The system SHALL validate the `azure-openai` provider config against `AzureProviderConfigSchema`, including `https` endpoint validation.

#### Scenario: Invalid type is rejected
- **WHEN** a config declares a provider with `type: "azure"` (not `"azure-openai"`)
- **THEN** the schema rejects it with a validation error

#### Scenario: Non-https endpoint is rejected
- **WHEN** an `azure-openai` provider config specifies an `endpoint` with a non-`https` scheme
- **THEN** the schema rejects it with a validation error
