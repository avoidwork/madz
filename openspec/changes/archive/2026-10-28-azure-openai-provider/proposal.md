## Why

Many enterprise users can only reach OpenAI-family models through Azure. Today the `openai` provider can only target a plain OpenAI-compatible `base_url` with a bearer `apiKey`; it cannot express Azure's resource endpoint, deployment names, `api-version`, or Entra ID auth. This change adds a dedicated `azure-openai` provider backed by `AzureChatOpenAI` from `@langchain/openai` (already a dependency), with authentication read exclusively from environment variables.

## What Changes

- Add an `azure-openai` provider type backed by `AzureChatOpenAI`.
- Add `AzureProviderConfigSchema` in `src/config/schemas/providers.js` with `type: z.literal("azure-openai")`, `enabled`, `model` (deployment name), optional `endpoint`, optional `apiVersion`, `temperature`, `maxTokens`, `contextWindow`, `reasoning`, and `rateLimit`, and NO `credentials` block.
- Add a `createAzureChatModel(config)` factory in `src/provider/azure.js` that reads `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT` (or `AZURE_OPENAI_API_INSTANCE_NAME`), `AZURE_OPENAI_API_DEPLOYMENT_NAME`, and optional `AZURE_OPENAI_API_VERSION` from `process.env`, throwing a clear error naming any missing variable.
- Route `type: "azure-openai"` to the new factory in `createChatModel` (in `src/provider/openai.js`).
- Audit `github-copilot`-only branches in `deepAgents.js`, `modelInfo.js`, and `tui/app.js` so Azure does not fall into Copilot-only paths.
- Add unit tests (`tests/unit/provider/azure.test.js`) and an integration test (`tests/integration/provider/azure.test.js`) with a mock HTTP server.
- Document the provider in the README with env-var examples.

## Capabilities

### New Capabilities
- `azure-openai-provider`: Running madz against models deployed in an Azure OpenAI / Microsoft Foundry resource, with env-var-only authentication and deployment-scoped routing.

### Modified Capabilities
- `model-context-length`: The context-length resolver must fall back to the configured `contextWindow` for Azure, which has no OpenAI-compatible `/models` endpoint.

## Impact

- `src/config/schemas/providers.js` — add `AzureProviderConfigSchema`.
- `src/config/schemas/index.js` and `src/config/config.js` — export the new schema.
- `src/provider/azure.js` — new factory.
- `src/provider/openai.js` — dispatch `azure-openai` to the new factory.
- `src/provider/index.js` — export the new factory.
- `src/agent/deepAgents.js`, `src/provider/modelInfo.js`, `src/tui/app.js` — audit Copilot-only branches.
- `tests/unit/provider/azure.test.js`, `tests/integration/provider/azure.test.js` — new tests.
- `README.md` — provider documentation.
- **Dependencies**: `@langchain/openai` ^1.7.0 (already present). No new dependency for the API-key path.

## Non-goals

- No Entra ID / managed identity auth (`@azure/identity`) in this change — it is a documented opt-in follow-up.
- No changes to the existing `openai` or `github-copilot` provider behavior.
- No new config `credentials` block for Azure; the key comes from `process.env` only.
