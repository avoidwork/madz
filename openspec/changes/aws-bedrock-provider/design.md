## Context

madz currently supports only OpenAI-compatible endpoints (`openai`) and GitHub Copilot (`github-copilot`) as LLM providers. The provider abstraction lives in `src/provider/` with a single model factory `createChatModel` in `src/provider/openai.js` hardwired to `ChatOpenAI`. Config schemas live in `src/config/schemas/providers.js`, where `ProvidersSchema` is currently `passthrough()`.

AWS-centric organizations can only use LLMs through Amazon Bedrock for data residency, billing, and IAM reasons. This design adds a `bedrock` provider type backed by `ChatBedrockConverse` from `@langchain/aws`, which provides a uniform interface and tool-calling across model families via the Converse API.

## Goals / Non-Goals

**Goals:**
- Add a `bedrock` provider type with a dedicated factory returning `ChatBedrockConverse`.
- Resolve auth from env vars or the default AWS credential chain, never from config files.
- Require a region (`BEDROCK_AWS_REGION` fallback `AWS_REGION`).
- Dispatch `type: "bedrock"` from `createChatModel` without branching inside the OpenAI factory.
- Add config schema, unit tests, an integration test, and documentation.

**Non-Goals:**
- No support for the legacy `ChatBedrock` (InvokeModel) API — Converse only.
- No credentials stored in config files or logs.
- No changes to OpenAI/Copilot behavior beyond dispatch and selection integration points.

## Decisions

### Decision 1: Dedicated factory in `src/provider/bedrock.js`
A separate factory (`createBedrockModel(config)`) is created rather than branching inside `createChatModel` in `openai.js`. The OpenAI factory carries OpenAI-specific opts (`configuration.baseURL`, `reasoning.effort`, `apiKey`) that do not apply to Bedrock. A dedicated module keeps the provider concerns isolated and mirrors the existing per-provider structure.

### Decision 2: Converse over legacy InvokeModel
`ChatBedrockConverse` is chosen over `ChatBedrock` (legacy InvokeModel API). The Converse API gives a uniform interface and tool-calling across model families, whereas the legacy API has per-model request formats and weaker tool support.

### Decision 3: Auth precedence
Auth is resolved in order:
1. `AWS_BEARER_TOKEN_BEDROCK` — Bedrock API key (bearer token).
2. `BEDROCK_AWS_ACCESS_KEY_ID` + `BEDROCK_AWS_SECRET_ACCESS_KEY` (+ optional `BEDROCK_AWS_SESSION_TOKEN`) — static or temporary credentials.
3. Default AWS credential provider chain (`AWS_PROFILE`, SSO, IAM role, ECS/EC2 metadata) — fallback when nothing above is set. This is achieved by omitting explicit `credentials` and letting the AWS SDK resolve them.

### Decision 4: Region required
`BEDROCK_AWS_REGION` (fallback `AWS_REGION`) is required. A clear error is thrown when it is missing.

### Decision 5: Config-driven contextWindow fallback
`src/provider/modelInfo.js` currently assumes OpenAI-style or Copilot model listing. Bedrock uses a config-driven `contextWindow` fallback rather than a hardcoded model list.

### Decision 6: Provider-agnostic middleware
Token budgeting is already middleware-based (`src/provider/tokenBudgetMiddleware.js`), so it is provider-agnostic. Converse `usage_metadata` feeds it. `copilotRetryMiddleware.js` is Copilot-specific and must not apply to Bedrock; `rateLimit.maxRetries` maps to the SDK client's `maxAttempts`.

## Risks / Trade-offs

- **[ProvidersSchema discriminated union may break existing configs]** → Ensure all existing provider variants (`openai`, `github-copilot`, plus any passthrough keys) are represented in the union; add `bedrock` variant.
- **[postinstall patch assumes only @langchain/openai]** → Verify `scripts/patch-langchain-reasoning.mjs` tolerates `@langchain/aws`; adjust if it throws.
- **[Mocking AWS SDK / LangChain Bedrock client in tests]** → Use the same mocking conventions as existing provider tests; mock the Bedrock Runtime client for the integration test.
- **[Throttling (`ThrottlingException`)]** → Map `rateLimit.maxRetries` to `maxAttempts` and rely on SDK retry/backoff.
- **[Temporary credentials without session token]** → Support `BEDROCK_AWS_ACCESS_KEY_ID` + `BEDROCK_AWS_SECRET_ACCESS_KEY` without requiring `BEDROCK_AWS_SESSION_TOKEN`.

## Migration Plan

1. Add `@langchain/aws` dependency.
2. Add `BedrockProviderConfigSchema` and update `ProvidersSchema`.
3. Create `src/provider/bedrock.js` factory.
4. Dispatch `type: "bedrock"` from `createChatModel`.
5. Add tests and documentation.
6. Verify with `npm run test`, `npm run lint`, `npm run coverage`.

Rollback: revert the feature branch; no data migration required.

## Open Questions

- Whether `@aws-sdk/credential-providers` is needed for explicit profile/SSO resolution beyond the SDK default chain. The issue lists it as an optional dependency; the default chain may suffice.
