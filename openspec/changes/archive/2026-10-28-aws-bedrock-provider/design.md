## Context

madz's LLM provider abstraction (`src/provider/`) currently supports `openai` (ChatOpenAI), `github-copilot` (ChatOpenAI with an OAuth fetch interceptor), and `azure-openai` (AzureChatOpenAI). The `createChatModel` factory in `src/provider/openai.js` is the single entry point used by `deepAgents.js` (orchestrator and per-agent temperature overrides); it branches on `type === "azure-openai"` (delegating to `createAzureChatModel`) and `type === "github-copilot"`. AWS-centric organizations need a provider that can reach foundation models through Amazon Bedrock, with auth from the AWS credential chain. `@langchain/aws` provides `ChatBedrockConverse`, which uses the Converse API for a uniform interface and tool-calling across model families.

## Goals / Non-Goals

**Goals:**
- Add a `bedrock` provider type backed by `ChatBedrockConverse`.
- Read authentication from `process.env` or the AWS credential chain only: `AWS_BEARER_TOKEN_BEDROCK`, then the `BEDROCK_AWS_*` key pair (with optional `BEDROCK_AWS_SESSION_TOKEN`), then the default credential provider chain.
- Resolve region from `BEDROCK_AWS_REGION` (fall back to `AWS_REGION`); it is required.
- Add `BedrockProviderConfigSchema` with no `credentials` block.
- Route `type: "bedrock"` to the new factory in `createChatModel`.
- Audit Copilot-only branches so Bedrock does not fall into them.
- Add unit and integration tests.

**Non-Goals:**
- No changes to existing `openai`, `github-copilot`, or `azure-openai` behavior.
- No new config `credentials` block for Bedrock.
- No legacy `ChatBedrock` (InvokeModel API) support — Converse only.

## Decisions

**Decision 1: Dedicated `src/provider/bedrock.js` factory, not a branch inside `openai.js`.**
- Rationale: `ChatBedrockConverse` constructs differently from `ChatOpenAI` (region, model ID / inference profile ARN, AWS credential resolution), and the OpenAI-specific opts (`configuration.baseURL`, `reasoning.effort`, `apiKey`) do not apply. A sibling module mirrors the `azure.js` / `copilotAuth.js` pattern and keeps `openai.js` focused.
- Alternative considered: adding a `bedrock` branch inside `createChatModel`. Rejected — it would bloat `openai.js` and mix concerns.

**Decision 2: Dispatch from `createChatModel` on `config.type === "bedrock"`.**
- Rationale: `createChatModel` is the single entry point used by `deepAgents.js` (orchestrator and per-agent temperature overrides). Routing Bedrock through it means the orchestrator and subagents get the right model without touching call sites.
- Alternative considered: a separate `createBedrockChatModel` call site in `deepAgents.js`. Rejected — it would duplicate provider selection logic and miss the per-agent temperature path.

**Decision 3: Auth precedence — bearer token, then key pair, then default credential chain.**
- Rationale: `AWS_BEARER_TOKEN_BEDROCK` is the highest-priority explicit key. The `BEDROCK_AWS_ACCESS_KEY_ID` / `BEDROCK_AWS_SECRET_ACCESS_KEY` pair (with optional `BEDROCK_AWS_SESSION_TOKEN`) covers static or temporary credentials. When neither is set, omit explicit `credentials` and let the AWS SDK resolve them via the default chain (`AWS_PROFILE`, SSO, IAM role, ECS/EC2 metadata).
- Alternative considered: always passing explicit credentials. Rejected — IAM roles and SSO come through the credential chain, which requires omitting `credentials`.

**Decision 4: Region required, resolved from `BEDROCK_AWS_REGION` then `AWS_REGION`.**
- Rationale: Bedrock requires a region for the endpoint. The factory throws a clear error naming the missing variable when neither env var is set.
- Alternative considered: a config `region` field only. Rejected — the issue specifies env-var resolution with a config fallback, and the schema also carries `region`.

**Decision 5: Context-length fallback for Bedrock in `modelInfo.js`.**
- Rationale: Bedrock has no OpenAI-compatible `/models` endpoint, so `getModelContextLength` would probe and fail. For Bedrock, fall back to the configured `contextWindow` rather than probing (mirroring the `azure-openai` branch).

**Decision 6: Middleware, not model patches, for rate-limit and token-budget enforcement.**
- Rationale: `bindTools()` rebuilds the model via `withConfig()`, orphaning instance-level `invoke`/`stream` overrides. The existing `TokenBudget` middleware is the enforcement point; Bedrock must follow the same constraint. Map `rateLimit.maxRetries` to the SDK client's `maxAttempts`.

**Decision 7: Model value may be a model ID, a cross-region inference profile ID (`us.` prefix), or an application inference profile ARN.**
- Rationale: The Converse API accepts all three. The schema accepts a `model` string and an optional `applicationInferenceProfile`; the factory passes the model through to `ChatBedrockConverse`.

## Risks / Trade-offs

- **[Risk] Bedrock construction requires env vars / region at model-build time** → Mitigation: the factory throws a clear error naming the missing variable; tests set/restore `process.env`.
- **[Risk] `@langchain/aws` is a new dependency** → Mitigation: it is the only new dependency; `@aws-sdk/credential-providers` is only added if explicit profile/SSO resolution is required beyond the SDK default chain.
- **[Risk] `postinstall` patch assumes `@langchain/openai` only** → Mitigation: `scripts/patch-langchain-reasoning.mjs` targets a specific `@langchain/openai` file path and skips gracefully if absent; adding `@langchain/aws` does not affect it.
- **[Risk] Bedrock falls into Copilot-only paths** → Mitigation: audit `deepAgents.js`, `modelInfo.js`, and `tui/app.js`; gate Copilot behavior strictly on `type === "github-copilot"`.
- **[Risk] Credentials / bearer tokens leak into logs** → Mitigation: never write secrets to config or logs; redact credentials and bearer tokens in errors (OWASP A09).
- **[Risk] Throttling (`ThrottlingException`) with retry/backoff** → Mitigation: map `rateLimit.maxRetries` to the SDK client's `maxAttempts`; the SDK handles retry/backoff.
