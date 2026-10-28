## 1. Dependency

- [x] 1.1 Add `@langchain/aws` to `package.json` dependencies and run `npm install`
- [x] 1.2 Confirm `postinstall` patches (`scripts/patch-langchain-reasoning.mjs`) still apply after the install

## 2. Config Schema

- [x] 2.1 Add `BedrockProviderConfigSchema` in `src/config/schemas/providers.js` with `type: z.literal("bedrock")`, `enabled`, `model`, `region`, optional `applicationInferenceProfile`, `temperature`, `maxTokens`, `contextWindow`, and `rateLimit`, and NO `credentials` block
- [x] 2.2 Export `BedrockProviderConfigSchema` from `src/config/schemas/index.js`
- [x] 2.3 Re-export `BedrockProviderConfigSchema` from `src/config/config.js`

## 3. Provider Factory

- [x] 3.1 Create `src/provider/bedrock.js` exporting `createBedrockChatModel(config)` that builds `ChatBedrockConverse` from `@langchain/aws`
- [x] 3.2 Resolve auth in precedence order: `AWS_BEARER_TOKEN_BEDROCK`, then `BEDROCK_AWS_ACCESS_KEY_ID` + `BEDROCK_AWS_SECRET_ACCESS_KEY` + optional `BEDROCK_AWS_SESSION_TOKEN`, then the default AWS credential chain (omit explicit `credentials`)
- [x] 3.3 Resolve region from `BEDROCK_AWS_REGION` (fall back to `AWS_REGION`), throwing a clear error when missing
- [x] 3.4 Honor `temperature`, `maxTokens` (omit `-1`), `rateLimit` (map `maxRetries` to SDK `maxAttempts`), and `streaming`; materialize the shared token budget when `maxTokensMinute > 0`
- [x] 3.5 Export `createBedrockChatModel` from `src/provider/index.js`

## 4. Dispatch

- [x] 4.1 In `src/provider/openai.js`, branch `createChatModel` on `config.type === "bedrock"` and delegate to `createBedrockChatModel`, leaving the existing `isCopilot` and `azure-openai` paths untouched

## 5. Copilot-Only Branch Audit

- [x] 5.1 Audit `src/agent/deepAgents.js` so Bedrock does not trigger `resolveCopilotModel` or the Copilot 403 retry middleware
- [x] 5.2 In `src/provider/modelInfo.js`, make `getModelContextLength` fall back to the configured `contextWindow` for `bedrock`
- [x] 5.3 Audit `src/tui/app.js` so Bedrock does not trigger the Copilot 401 re-auth handler

## 6. Unit Tests

- [x] 6.1 Write `tests/unit/provider/bedrock.test.js` covering schema validation, auth precedence, region resolution, and missing-region error

## 7. Integration Test

- [x] 7.1 Write `tests/integration/provider/bedrock.test.js` using a mocked Bedrock Runtime client asserting the Converse request shape, streaming, tool calls, and throttling retry behavior

## 8. Documentation

- [x] 8.1 Add JSDoc to all public functions in `src/provider/bedrock.js`
- [x] 8.2 Add a README provider section documenting `type: "bedrock"`, the `BEDROCK_AWS_*` / `AWS_BEARER_TOKEN_BEDROCK` env vars, and a least-privilege IAM note

## 9. Verification

- [x] 9.1 Run `npm run lint`, `npm run test`, and `npm run coverage` and ensure they pass
