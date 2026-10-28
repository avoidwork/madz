## ADDED Requirements

### Requirement: Bedrock provider config schema
The system SHALL support a `bedrock` provider type in the config schema. The `BedrockProviderConfigSchema` SHALL include `type: z.literal("bedrock")`, `enabled` (default `true`), `model`, `region`, an optional `applicationInferenceProfile`, `temperature`, `maxTokens`, `contextWindow`, and `rateLimit`. It SHALL NOT include a `credentials` block — all secrets come from environment variables or the AWS credential chain. The `model` value SHALL accept a model ID, a cross-region inference profile ID (with a `us.` prefix), or an application inference profile ARN.

#### Scenario: Valid Bedrock provider config
- **WHEN** a config declares `providers.bedrock` with `type: "bedrock"`, a `model`, and a `region`
- **THEN** the config validates successfully

#### Scenario: Missing region fails validation
- **WHEN** a `bedrock` provider is declared without a `region`
- **THEN** config validation fails with a clear error

#### Scenario: Bedrock config rejects a credentials block
- **WHEN** a `bedrock` provider config includes a `credentials` block
- **THEN** the schema rejects the config (secrets must come from env or the AWS credential chain)

#### Scenario: Bedrock enabled defaults to true
- **WHEN** a `bedrock` provider config is validated without an `enabled` field
- **THEN** the schema applies the default value of `true`

#### Scenario: Bedrock accepts an application inference profile
- **WHEN** a `bedrock` provider config sets `applicationInferenceProfile` to an ARN
- **THEN** the schema validates successfully and preserves the value

#### Scenario: Bedrock accepts a cross-region inference profile model
- **WHEN** a `bedrock` provider config sets `model` to a cross-region inference profile ID with a `us.` prefix
- **THEN** the schema validates successfully

### Requirement: Bedrock provider factory returns ChatBedrockConverse
The system SHALL provide a factory in `src/provider/bedrock.js` that returns a `ChatBedrockConverse` instance for `type: "bedrock"`. The factory SHALL resolve auth in precedence order: `AWS_BEARER_TOKEN_BEDROCK`, then the `BEDROCK_AWS_*` key pair, then the default AWS credential chain. It SHALL require a region (`BEDROCK_AWS_REGION` fallback `AWS_REGION`) and throw a clear error when it is missing.

#### Scenario: Factory returns ChatBedrockConverse
- **WHEN** `createBedrockModel(config)` is called with a valid `bedrock` config
- **THEN** it returns a `ChatBedrockConverse` instance

#### Scenario: Auth precedence uses bearer token first
- **WHEN** `AWS_BEARER_TOKEN_BEDROCK` is set
- **THEN** the factory uses it as the bearer token for authentication

#### Scenario: Auth precedence uses key pair when no bearer token
- **WHEN** `AWS_BEARER_TOKEN_BEDROCK` is not set but `BEDROCK_AWS_ACCESS_KEY_ID` and `BEDROCK_AWS_SECRET_ACCESS_KEY` are set
- **THEN** the factory uses the static/temporary credentials

#### Scenario: Key pair works without a session token
- **WHEN** `BEDROCK_AWS_ACCESS_KEY_ID` and `BEDROCK_AWS_SECRET_ACCESS_KEY` are set but `BEDROCK_AWS_SESSION_TOKEN` is not
- **THEN** the factory uses the static credentials without requiring a session token

#### Scenario: Auth precedence falls back to default credential chain
- **WHEN** neither the bearer token nor the key pair is set
- **THEN** the factory omits explicit `credentials` and lets the AWS SDK resolve them via the default chain

#### Scenario: Missing region throws a clear error
- **WHEN** neither `BEDROCK_AWS_REGION` nor `AWS_REGION` is set
- **THEN** the factory throws a clear error indicating the region is required

#### Scenario: Region resolves from BEDROCK_AWS_REGION
- **WHEN** `BEDROCK_AWS_REGION` is set
- **THEN** the factory uses it as the region

#### Scenario: Region falls back to AWS_REGION
- **WHEN** `BEDROCK_AWS_REGION` is not set but `AWS_REGION` is set
- **THEN** the factory uses `AWS_REGION` as the region

### Requirement: Bedrock dispatch from createChatModel
The system SHALL dispatch `type: "bedrock"` from `createChatModel` to the Bedrock factory, without branching inside the OpenAI factory. Copilot-specific logic and middleware SHALL NOT apply to Bedrock.

#### Scenario: createChatModel dispatches bedrock type
- **WHEN** `createChatModel` is called with `type: "bedrock"`
- **THEN** it routes to the Bedrock factory and returns a `ChatBedrockConverse` instance

#### Scenario: Copilot-specific logic does not apply to Bedrock
- **WHEN** a `bedrock` provider is used
- **THEN** `type === "github-copilot"`-specific logic in `deepAgents.js` is bypassed

#### Scenario: Copilot retry middleware does not apply to Bedrock
- **WHEN** a `bedrock` provider is used
- **THEN** the Copilot-specific retry middleware is not applied

### Requirement: Bedrock model metadata uses config-driven contextWindow
The system SHALL use a config-driven `contextWindow` fallback for Bedrock model metadata rather than assuming an OpenAI-style or Copilot model listing.

#### Scenario: Bedrock contextWindow comes from config
- **WHEN** a `bedrock` provider config specifies a `contextWindow`
- **THEN** model metadata uses that value as the context window

### Requirement: Bedrock token budget consumes Converse usage metadata
The system SHALL feed Converse `usage_metadata` from the Bedrock provider into the token-budget middleware so token budgeting is provider-agnostic.

#### Scenario: Bedrock usage metadata feeds token budget
- **WHEN** a Bedrock model dispatch returns `usage_metadata`
- **THEN** the token-budget middleware reconciles the reservation to the actual token total
