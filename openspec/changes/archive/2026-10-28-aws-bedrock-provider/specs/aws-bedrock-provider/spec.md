## ADDED Requirements

### Requirement: Bedrock provider configuration
The system SHALL support a `bedrock` provider type in the config schema that does not require a static `credentials.apiKey`. The `BedrockProviderConfigSchema` SHALL include an `enabled` boolean field defaulting to `true`, a `model` field, a `region` field, an optional `applicationInferenceProfile`, `temperature`, `maxTokens`, `contextWindow`, and `rateLimit`, and SHALL NOT include a `credentials` block.

#### Scenario: Valid Bedrock provider config
- **WHEN** a config declares `providers.bedrock` with `type: "bedrock"`, a `model`, and a `region`
- **THEN** the config validates successfully

#### Scenario: Missing model
- **WHEN** a `bedrock` provider is declared without a `model`
- **THEN** config validation fails with a clear error

#### Scenario: Missing region
- **WHEN** a `bedrock` provider is declared without a `region`
- **THEN** config validation fails with a clear error

#### Scenario: Bedrock enabled defaults to true
- **WHEN** a `bedrock` provider config is validated without an `enabled` field
- **THEN** the schema applies the default value of `true`

#### Scenario: Bedrock can be disabled
- **WHEN** a `bedrock` provider config sets `enabled: false`
- **THEN** the schema validates successfully and preserves `false`

#### Scenario: No credentials block
- **WHEN** a `bedrock` provider config is validated
- **THEN** the schema does not require or accept a `credentials` block (secrets come from env or the AWS credential chain)

#### Scenario: Application inference profile ARN accepted
- **WHEN** a `bedrock` provider config specifies an `applicationInferenceProfile` ARN
- **THEN** the schema validates successfully

### Requirement: Bedrock provider factory builds ChatBedrockConverse
The system SHALL provide a factory that builds a `ChatBedrockConverse` instance for `type: "bedrock"`, resolving authentication in precedence order: `AWS_BEARER_TOKEN_BEDROCK`, then the `BEDROCK_AWS_ACCESS_KEY_ID` / `BEDROCK_AWS_SECRET_ACCESS_KEY` pair (with optional `BEDROCK_AWS_SESSION_TOKEN`), then the default AWS credential provider chain.

#### Scenario: Factory returns ChatBedrockConverse
- **WHEN** `createBedrockChatModel` is called with a valid `bedrock` config and the required env vars are set
- **THEN** it returns a `ChatBedrockConverse` instance

#### Scenario: Bearer token takes precedence
- **WHEN** `AWS_BEARER_TOKEN_BEDROCK` is set
- **THEN** the factory uses it as the bearer token for authentication

#### Scenario: Static credentials used when no bearer token
- **WHEN** `AWS_BEARER_TOKEN_BEDROCK` is unset but `BEDROCK_AWS_ACCESS_KEY_ID` and `BEDROCK_AWS_SECRET_ACCESS_KEY` are set
- **THEN** the factory uses the static credentials

#### Scenario: Session token passed through
- **WHEN** `BEDROCK_AWS_SESSION_TOKEN` is set alongside the key pair
- **THEN** the factory passes the session token through

#### Scenario: Default credential chain used when nothing set
- **WHEN** neither `AWS_BEARER_TOKEN_BEDROCK` nor the `BEDROCK_AWS_*` key pair is set
- **THEN** the factory omits explicit `credentials` and lets the AWS SDK resolve them via the default credential provider chain

#### Scenario: Region resolved from BEDROCK_AWS_REGION
- **WHEN** `BEDROCK_AWS_REGION` is set
- **THEN** the factory uses it as the region

#### Scenario: Region falls back to AWS_REGION
- **WHEN** `BEDROCK_AWS_REGION` is unset but `AWS_REGION` is set
- **THEN** the factory uses `AWS_REGION` as the region

#### Scenario: Missing region throws a clear error
- **WHEN** neither `BEDROCK_AWS_REGION` nor `AWS_REGION` is set
- **THEN** the factory throws an error naming the missing region variable

### Requirement: Bedrock provider is dispatched from createChatModel
The system SHALL route `type: "bedrock"` to the Bedrock factory from `createChatModel`, so the orchestrator and subagents get the correct model without touching call sites.

#### Scenario: createChatModel dispatches Bedrock
- **WHEN** `createChatModel` is called with a config whose `type` is `"bedrock"`
- **THEN** it returns a `ChatBedrockConverse` instance

#### Scenario: createChatModel preserves OpenAI behavior
- **WHEN** `createChatModel` is called with a config whose `type` is `"openai"`
- **THEN** it returns a `ChatOpenAI` instance

#### Scenario: createChatModel preserves Copilot behavior
- **WHEN** `createChatModel` is called with a config whose `type` is `"github-copilot"`
- **THEN** it returns a `ChatOpenAI` instance with the Copilot fetch interceptor

### Requirement: Bedrock provider does not fall into Copilot-only paths
The system SHALL ensure that a `bedrock` provider does not trigger Copilot-only behavior in `deepAgents.js`, `modelInfo.js`, or `tui/app.js`.

#### Scenario: Bedrock does not trigger Copilot model resolution
- **WHEN** the active provider type is `bedrock`
- **THEN** `deepAgents.js` does not call `resolveCopilotModel`

#### Scenario: Bedrock does not trigger Copilot retry middleware
- **WHEN** the active provider type is `bedrock`
- **THEN** the Copilot 403 retry middleware is not registered

#### Scenario: Bedrock context length falls back to config
- **WHEN** `getModelContextLength` is called with a `bedrock` provider config
- **THEN** it falls back to the configured `contextWindow` rather than probing a `/models` endpoint

#### Scenario: Bedrock does not trigger Copilot 401 re-auth
- **WHEN** the active provider type is `bedrock`
- **THEN** the TUI does not register the Copilot 401 re-auth handler

### Requirement: Bedrock provider maps retry to SDK maxAttempts
The system SHALL map `rateLimit.maxRetries` to the Bedrock SDK client's `maxAttempts`, and SHALL NOT apply the Copilot-specific retry middleware to Bedrock.

#### Scenario: maxRetries maps to maxAttempts
- **WHEN** a `bedrock` provider config sets `rateLimit.maxRetries`
- **THEN** the factory passes it to the SDK client as `maxAttempts`

#### Scenario: Copilot retry middleware not applied to Bedrock
- **WHEN** the active provider type is `bedrock`
- **THEN** the Copilot 403 retry middleware is not registered

### Requirement: Bedrock provider validates inputs with a Zod schema
The system SHALL validate the `bedrock` provider config against `BedrockProviderConfigSchema`, including region and model / inference profile format validation.

#### Scenario: Invalid type is rejected
- **WHEN** a config declares a provider with `type: "bedrock"` but an invalid shape
- **THEN** the schema rejects it with a validation error

#### Scenario: Invalid region is rejected
- **WHEN** a `bedrock` provider config specifies an invalid `region`
- **THEN** the schema rejects it with a validation error
