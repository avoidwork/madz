## 1. Add the summarization config schema

- [x] 1.1 Create `src/config/schemas/summarization.js` exporting `SummarizationSchema` (Zod): `enabled` (boolean, default `false`), `trigger` (discriminated on `type: "tokens" | "messages" | "fraction"` with a positive `value`), `keep` (same shape), and optional `historyPathPrefix`
- [x] 1.2 Re-export `SummarizationSchema` from `src/config/schemas/index.js`
- [x] 1.3 Register `summarization: SummarizationSchema.default({})` in `ConfigSchema` in `src/config/config.js`
- [x] 1.4 Add unit tests in `tests/unit/config/summarization.test.js`: valid token/message/fraction triggers, rejection of zero/negative values, wrong types, unknown keys, and the absent-section case resolving to documented defaults

## 2. Build the summarization middleware factory

- [x] 2.1 Create `src/provider/summarizationMiddleware.js` mirroring `src/provider/tokenBudgetMiddleware.js`'s shape, returning `createSummarizationMiddleware({ backend, trigger, keep, historyPathPrefix })` from `deepagents`, or `null` when `enabled` is false
- [x] 2.2 Always pass `keep` explicitly (never rely on the library default of 20)
- [x] 2.3 Add unit tests in `tests/unit/provider/summarizationMiddleware.test.js`: enabled config returns the middleware with configured trigger/keep, disabled config returns null, and trigger-without-keep still passes an explicit keep

## 3. Wire it into the orchestrator

- [x] 3.1 In `src/agent/deepAgents.js`, insert the custom `SummarizationMiddleware` into the `middleware` array **before** `tokenBudgetMiddleware`, named exactly `SummarizationMiddleware` so the same-name merge displaces the library default
- [x] 3.2 Spread it conditionally so unset config is a true no-op (today's behavior preserved)

## 4. Prove it fires at runtime (blocking acceptance criterion)

- [x] 4.1 Add a runtime probe (log line or assertion) that shows compaction at the configured value, not the 170k default
- [x] 4.2 Show the library default `SummarizationMiddleware` is genuinely absent from the effective stack
- [x] 4.3 Verify the probe for the orchestrator **and** one subagent

## 5. Document and verify subagent behavior + offload scheme

- [x] 5.1 Document and verify whether the custom middleware applies to subagents or only the orchestrator
- [x] 5.2 Confirm the offload filename scheme empirically (write a transcript, inspect the sandbox filesystem) and record the confirmed scheme in docs/JSDoc

## 6. Verify

- [x] 6.1 Run `npm run test`
- [x] 6.2 Run `npm run lint`
- [x] 6.3 Run `npm run coverage`
