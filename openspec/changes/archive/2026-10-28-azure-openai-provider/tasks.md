## 1. Config Schema

- [x] 1.1 Add `AzureProviderConfigSchema` in `src/config/schemas/providers.js` with `type: z.literal("azure-openai")`, `enabled`, `model` (deployment name), optional `endpoint`, optional `apiVersion`, `temperature`, `maxTokens`, `contextWindow`, `reasoning`, and `rateLimit`, and NO `credentials` block
- [x] 1.2 Export `AzureProviderConfigSchema` from `src/config/schemas/index.js`
- [x] 1.3 Re-export `AzureProviderConfigSchema` from `src/config/config.js`

## 2. Provider Factory

- [x] 2.1 Create `src/provider/azure.js` exporting `createAzureChatModel(config)` that builds `AzureChatOpenAI` from `@langchain/openai`
- [x] 2.2 Resolve `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT` (or `AZURE_OPENAI_API_INSTANCE_NAME`), `AZURE_OPENAI_API_DEPLOYMENT_NAME`, and optional `AZURE_OPENAI_API_VERSION` from `process.env`, throwing a clear error naming any missing variable
- [x] 2.3 Honor `temperature`, `maxTokens` (omit `-1`), `rateLimit` (maxRetries/maxConcurrency), and `reasoning`; materialize the shared token budget when `maxTokensMinute > 0`
- [x] 2.4 Export `createAzureChatModel` from `src/provider/index.js`

## 3. Dispatch

- [x] 3.1 In `src/provider/openai.js`, branch `createChatModel` on `config.type === "azure-openai"` and delegate to `createAzureChatModel`, leaving the existing `isCopilot` path untouched

## 4. Copilot-Only Branch Audit

- [x] 4.1 Audit `src/agent/deepAgents.js` so Azure does not trigger `resolveCopilotModel` or the Copilot 403 retry middleware
- [x] 4.2 In `src/provider/modelInfo.js`, make `getModelContextLength` fall back to the configured `contextWindow` for `azure-openai`
- [x] 4.3 Audit `src/tui/app.js` so Azure does not trigger the Copilot 401 re-auth handler

## 5. Unit Tests

- [x] 5.1 Write `tests/unit/provider/azure.test.js` covering schema validation, env resolution, missing-var errors, endpoint resolution, and deployment-name-as-model

## 6. Integration Test

- [x] 6.1 Write `tests/integration/provider/azure.test.js` using a mock HTTP server asserting the `api-key` header, deployment path, `api-version`, streaming, tool calls, and 429 retry behavior

## 7. Documentation

- [x] 7.1 Add JSDoc to all public functions in `src/provider/azure.js`
- [x] 7.2 Add a README provider section documenting `type: "azure-openai"` and the `AZURE_OPENAI_*` env vars

## 8. Verification

- [x] 8.1 Run `npm run lint`, `npm run test`, and `npm run coverage` and ensure they pass
