## 1. Dependency

- [ ] 1.1 Add `@langchain/aws` to `dependencies` in `package.json` and run `npm install`
- [ ] 1.2 Verify `scripts/patch-langchain-reasoning.mjs` (postinstall) still applies with `@langchain/aws` present

## 2. Config Schema

- [ ] 2.1 Add `BedrockProviderConfigSchema` in `src/config/schemas/providers.js` with `type: z.literal("bedrock")`, `enabled`, `model`, `region`, optional `applicationInferenceProfile`, `temperature`, `maxTokens`, `contextWindow`, and `rateLimit` (no `credentials` block)
- [ ] 2.2 Convert `ProvidersSchema` from `passthrough()` to a discriminated union that includes the new `bedrock` variant

## 3. Provider Factory

- [ ] 3.1 Create `src/provider/bedrock.js` exporting a factory that builds a `ChatBedrockConverse` instance
- [ ] 3.2 Resolve auth in precedence order: `AWS_BEARER_TOKEN_BEDROCK`, then `BEDROCK_AWS_*` key pair, then default AWS credential chain
- [ ] 3.3 Require a region (`BEDROCK_AWS_REGION` fallback `AWS_REGION`) and throw a clear error when missing
- [ ] 3.4 Map `rateLimit.maxRetries` to the SDK client's `maxAttempts`

## 4. Dispatch

- [ ] 4.1 Route `type: "bedrock"` from `createChatModel` to the Bedrock factory (without branching inside the OpenAI factory)
- [ ] 4.2 Ensure `deepAgents.js` bypasses `type === "github-copilot"`-specific logic for Bedrock
- [ ] 4.3 Ensure `modelInfo.js` uses a config-driven `contextWindow` fallback for Bedrock
- [ ] 4.4 Ensure `tokenBudgetMiddleware.js` consumes Converse `usage_metadata` for Bedrock
- [ ] 4.5 Ensure `copilotRetryMiddleware.js` does not apply to Bedrock

## 5. Tests

- [ ] 5.1 Add `tests/unit/provider/bedrock.test.js` covering factory returns `ChatBedrockConverse`, auth precedence, and region errors
- [ ] 5.2 Add an integration test with a mocked Bedrock Runtime client for Converse streaming and tool-call round trips

## 6. Documentation

- [ ] 6.1 Add JSDoc to the Bedrock factory
- [ ] 6.2 Add a README provider section for Bedrock with a least-privilege IAM note

## 7. Verification

- [ ] 7.1 Run `npm run test`
- [ ] 7.2 Run `npm run lint`
- [ ] 7.3 Run `npm run coverage`
