## Why

Many AWS-centric organizations can only reach LLMs through Amazon Bedrock for data residency, billing, and IAM reasons. madz currently supports only OpenAI-compatible endpoints, GitHub Copilot, and Azure OpenAI, so these users are blocked. This change adds a `bedrock` provider backed by `ChatBedrockConverse` from `@langchain/aws`, with authentication read from environment variables or the standard AWS credential chain — never from config files.

## What Changes

- Add a `bedrock` provider type backed by `ChatBedrockConverse`.
- Add `BedrockProviderConfigSchema` in `src/config/schemas/providers.js` with `type: z.literal("bedrock")`, `enabled`, `model`, `region`, optional `applicationInferenceProfile`, `temperature`, `maxTokens`, `contextWindow`, and `rateLimit`, and NO `credentials` block.
- Add a `createBedrockChatModel(config)` factory in `src/provider/bedrock.js` that resolves auth in precedence order: `AWS_BEARER_TOKEN_BEDROCK`, then the `BEDROCK_AWS_*` key pair (with optional `BEDROCK_AWS_SESSION_TOKEN`), then the default AWS credential provider chain. Region comes from `BEDROCK_AWS_REGION` (fall back to `AWS_REGION`) and is required.
- Route `type: "bedrock"` to the new factory in `createChatModel` (in `src/provider/openai.js`).
- Audit `github-copilot`-only branches in `deepAgents.js`, `modelInfo.js`, and `tui/app.js` so Bedrock does not fall into Copilot-only paths.
- Add unit tests (`tests/unit/provider/bedrock.test.js`) and an integration test (`tests/integration/provider/bedrock.test.js`) with a mocked Bedrock Runtime client.
- Document the provider in the README with env-var examples and a least-privilege IAM note.

## Capabilities

### New Capabilities
- `aws-bedrock-provider`: Running madz against foundation models hosted in Amazon Bedrock, with env-var / credential-chain authentication and Converse API routing.

### Modified Capabilities
- `model-context-length`: The context-length resolver must fall back to the configured `contextWindow` for Bedrock, which has no OpenAI-compatible `/models` endpoint.

## Impact

- `src/config/schemas/providers.js` — add `BedrockProviderConfigSchema`.
- `src/config/schemas/index.js` and `src/config/config.js` — export the new schema.
- `src/provider/bedrock.js` — new factory.
- `src/provider/openai.js` — dispatch `bedrock` to the new factory.
- `src/provider/index.js` — export the new factory.
- `src/agent/deepAgents.js`, `src/provider/modelInfo.js`, `src/tui/app.js` — audit Copilot-only branches.
- `tests/unit/provider/bedrock.test.js`, `tests/integration/provider/bedrock.test.js` — new tests.
- `README.md` — provider documentation.
- **Dependencies**: `@langchain/aws` (new). `@aws-sdk/credential-providers` only if explicit profile/SSO resolution is needed beyond the SDK default chain.

## Non-goals

- No changes to the existing `openai`, `github-copilot`, or `azure-openai` provider behavior.
- No new config `credentials` block for Bedrock; secrets come from `process.env` or the AWS credential chain only.
- No legacy `ChatBedrock` (InvokeModel API) support — Converse only.
