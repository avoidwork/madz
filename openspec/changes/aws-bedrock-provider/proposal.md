## Why

Many AWS-centric organizations can only use LLMs through Amazon Bedrock for data residency, billing, and IAM reasons. madz currently supports only OpenAI-compatible endpoints and GitHub Copilot, so these users are blocked. This change adds a `bedrock` provider type backed by `ChatBedrockConverse` from `@langchain/aws`, giving a uniform interface and tool-calling across model families.

## What Changes

- Add `@langchain/aws` as a dependency.
- Add `BedrockProviderConfigSchema` in `src/config/schemas/providers.js` with `type: z.literal("bedrock")`, `enabled`, `model`, `region`, optional `applicationInferenceProfile`, `temperature`, `maxTokens`, `contextWindow`, and `rateLimit`. No `credentials` block — secrets come from env or the AWS credential chain only.
- Convert `ProvidersSchema` from `passthrough()` to a discriminated union that includes the new `bedrock` variant.
- Create `src/provider/bedrock.js` exporting a factory that builds a `ChatBedrockConverse` instance. Auth precedence: `AWS_BEARER_TOKEN_BEDROCK`, then the `BEDROCK_AWS_*` key pair, then the default AWS credential chain. Region is required (`BEDROCK_AWS_REGION` fallback `AWS_REGION`).
- Dispatch `type: "bedrock"` from `createChatModel` to the Bedrock factory, without branching inside the OpenAI factory.
- Ensure `deepAgents.js`, `modelInfo.js`, `tokenBudgetMiddleware.js`, and `copilotRetryMiddleware.js` handle Bedrock correctly (config-driven `contextWindow` fallback, Converse `usage_metadata` feeding token budget, Copilot-specific middleware not applied).
- Add unit tests (`tests/unit/provider/bedrock.test.js`) and an integration test with a mocked Bedrock Runtime client.
- Document the provider in the README with a least-privilege IAM note.

## Capabilities

### New Capabilities
- `aws-bedrock-provider`: Support for the `bedrock` provider type, including config schema, model factory, auth precedence, region resolution, and dispatch from `createChatModel`.

### Modified Capabilities
- `provider-enabled-flag`: The active-provider selection rule (`getActiveProviderConfig`) must recognize the new `bedrock` provider type alongside `openai` and `github-copilot`.
- `provider-token-budget`: Token budgeting must consume Converse `usage_metadata` from the Bedrock provider.

## Impact

- **Dependencies**: `@langchain/aws` added to `package.json`; verify `scripts/patch-langchain-reasoning.mjs` (postinstall) tolerates the new package.
- **Code**: `src/config/schemas/providers.js`, `src/provider/bedrock.js` (new), `src/provider/index.js`, `src/provider/openai.js`, `src/agent/deepAgents.js`, `src/provider/modelInfo.js`, `src/provider/tokenBudgetMiddleware.js`, `src/provider/copilotRetryMiddleware.js`.
- **Tests**: `tests/unit/provider/bedrock.test.js` (new), integration test for Converse streaming/tool calls.
- **Docs**: `README.md` provider section, least-privilege IAM note.

## Non-goals

- No support for the legacy `ChatBedrock` (InvokeModel) API — Converse only.
- No credentials stored in config files or logs; all secrets come from `process.env` or the AWS credential chain.
- No changes to the OpenAI or Copilot provider behavior beyond the dispatch and selection integration points.
