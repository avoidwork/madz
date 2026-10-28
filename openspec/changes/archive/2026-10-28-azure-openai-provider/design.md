## Context

madz's LLM provider abstraction (`src/provider/`) currently supports two provider types: `openai` (ChatOpenAI) and `github-copilot` (ChatOpenAI with an OAuth fetch interceptor). The `createChatModel` factory in `src/provider/openai.js` is hardwired to `ChatOpenAI` and branches only on `type === "github-copilot"`. Enterprise users who can only reach OpenAI-family models through Azure need a provider that expresses Azure's resource endpoint, deployment names, `api-version`, and env-var-only auth. `@langchain/openai` ^1.7.0 already provides `AzureChatOpenAI`, so no new dependency is required for the API-key path.

## Goals / Non-Goals

**Goals:**
- Add an `azure-openai` provider type backed by `AzureChatOpenAI`.
- Read authentication from `process.env` only (`AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`/`AZURE_OPENAI_API_INSTANCE_NAME`, `AZURE_OPENAI_API_DEPLOYMENT_NAME`, optional `AZURE_OPENAI_API_VERSION`).
- Add `AzureProviderConfigSchema` with no `credentials` block.
- Route `type: "azure-openai"` to the new factory in `createChatModel`.
- Audit Copilot-only branches so Azure does not fall into them.
- Add unit and integration tests.

**Non-Goals:**
- No Entra ID / managed identity auth (`@azure/identity`) — documented opt-in follow-up.
- No changes to existing `openai` or `github-copilot` behavior.
- No new config `credentials` block for Azure.

## Decisions

**Decision 1: Dedicated `src/provider/azure.js` factory, not a branch inside `openai.js`.**
- Rationale: Azure's construction differs materially from `ChatOpenAI` (deployment-scoped endpoint, `api-version`, env-var auth). A sibling module keeps `openai.js` focused and mirrors the existing `copilotAuth.js`/`copilotRetryMiddleware.js` pattern of provider-specific modules.
- Alternative considered: adding an `azure` branch inside `createChatModel`. Rejected — it would bloat `openai.js` and mix concerns.

**Decision 2: Dispatch from `createChatModel` on `config.type === "azure-openai"`.**
- Rationale: `createChatModel` is the single entry point used by `deepAgents.js` (orchestrator and per-agent temperature overrides). Routing Azure through it means the orchestrator and subagents get the right model without touching call sites.
- Alternative considered: a separate `createAzureChatModel` call site in `deepAgents.js`. Rejected — it would duplicate the provider selection logic and miss the per-agent temperature path.

**Decision 3: Env-var-only auth, no `credentials` block.**
- Rationale: The issue explicitly requires never writing the key to config or logs (OWASP A09). `AzureChatOpenAI` reads `AZURE_OPENAI_*` natively, so the factory resolves them from `process.env` and throws a clear error naming any missing variable.
- Alternative considered: a `credentials.apiKey` block like `openai`. Rejected — it would copy the plaintext-secret pattern the issue warns against.

**Decision 4: Endpoint resolution supports both `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_INSTANCE_NAME`.**
- Rationale: LangChain.js accepts either the full endpoint or an instance name. Prefer `AZURE_OPENAI_ENDPOINT` when present; otherwise derive `https://<instance>.openai.azure.com` from `AZURE_OPENAI_API_INSTANCE_NAME`.

**Decision 5: Context-length fallback for Azure in `modelInfo.js`.**
- Rationale: Azure has no OpenAI-compatible `/models` endpoint, so `getModelContextLength` would probe and fail. For Azure, fall back to the configured `contextWindow` rather than probing.

**Decision 6: Middleware, not model patches, for rate-limit and token-budget enforcement.**
- Rationale: `bindTools()` rebuilds the model via `withConfig()`, orphaning instance-level `invoke`/`stream` overrides. The existing `TokenBudget` middleware is the enforcement point; Azure must follow the same constraint.

## Risks / Trade-offs

- **[Risk] Azure construction requires env vars at model-build time** → Mitigation: the factory throws a clear error naming the missing variable; tests set/restore `process.env`.
- **[Risk] Endpoint with a trailing slash** → Mitigation: normalize the endpoint by stripping trailing slashes before passing to `AzureChatOpenAI`.
- **[Risk] Deployment name differs from model name** → Mitigation: the `model` config field maps to `azureOpenAIApiDeploymentName`; the deployment name is the model.
- **[Risk] Azure has no `/models` endpoint** → Mitigation: `getModelContextLength` falls back to the configured `contextWindow` for Azure.
- **[Risk] Azure falls into Copilot-only paths** → Mitigation: audit `deepAgents.js`, `modelInfo.js`, and `tui/app.js`; gate Copilot behavior strictly on `type === "github-copilot"`.
