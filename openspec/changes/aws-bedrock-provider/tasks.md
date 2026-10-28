## 1. Dependency

- [x] 1.1 Add `@langchain/aws` to `dependencies` in `package.json` and run `npm install`
- [x] 1.2 Verify `scripts/patch-langchain-reasoning.mjs` (postinstall) still applies with `@langchain/aws` present

## 2. Config Schema

- [x] 2.1 Add `BedrockProviderConfigSchema` in `src/config/schemas/providers.js` with `type: z.literal("bedrock")`, `enabled`, `model`, `region`, optional `applicationInferenceProfile`, `temperature`, `maxTokens`, `contextWindow`, and `rateLimit` (no `credentials` block)
- [x] 2.2 Convert `ProvidersSchema` from `passthrough()` to a discriminated union that includes the new `bedrock` variant

## 3. Provider Factory

- [x] 3.1 Create `src/provider/bedrock.js` exporting a factory that builds a `ChatBedrockConverse` instance
- [x] 3.2 Resolve auth in precedence order: `AWS_BEARER_TOKEN_BEDROCK`, then `BEDROCK_AWS_*` key pair, then default AWS credential chain
- [x] 3.3 Require a region (`BEDROCK_AWS_REGION` fallback `AWS_REGION`) and throw a clear error when missing
- [x] 3.4 Map `rateLimit.maxRetries` to the SDK client.s `maxAttempts`

## 4. Dispatch

- [x] 4.1 Route `type: "bedrock"` from `createChatModel` to the Bedrock factory (without branching inside the OpenAI factory)
- [x] 4.2 Ensure `deepAgents.js` bypasses `type === "github-copilot"`-specific logic for Bedrock
- [x] 4.3 Ensure `modelInfo.js` uses a config-driven `contextWindow` fallback for Bedrock
- [x] 4.4 Ensure `tokenBudgetMiddleware.js` consumes Converse `usage_metadata` for Bedrock
- [x] 4.5 Ensure `copilotRetryMiddleware.js` does not apply to Bedrock

## 5. Tests

- [x] 5.1 Add `tests/unit/provider/bedrock.test.js` covering factory returns `ChatBedrockConverse`, auth precedence, and region errors
- [x] 5.2 Add an integration test with a mocked Bedrock Runtime client for Converse streaming and tool-call round trips

## 6. Documentation

- [x] 6.1 Add JSDoc to the Bedrock factory
- [x] 6.2 Add a README provider section for Bedrock with a least-privilege IAM note

## 7. Verification

- [x] 7.1 Run `npm run test`
- [x] 7.2 Run `npm run lint`
- [x] 7.3 Run `npm run coverage`
