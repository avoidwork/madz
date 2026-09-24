## 1. Add the summarization config schema

- [ ] 1.1 Create `src/config/schemas/summarization.js` exporting `SummarizationSchema` (Zod): `enabled` (boolean, default `false`), `trigger` (discriminated on `type: "tokens" | "messages" | "fraction"` with a positive `value`), `keep` (same shape), and optional `historyPathPrefix`
- [ ] 1.2 Re-export `SummarizationSchema` from `src/config/schemas/index.js`
- [ ] 1.3 Register `summarization: SummarizationSchema.default({})` in `ConfigSchema` in `src/config/config.js`
- [ ] 1.4 Add unit tests in `tests/unit/config/summarization.test.js`: valid token/message/fraction triggers, rejection of zero/negative values, wrong types, unknown keys, and the absent-section case resolving to documented defaults

## 2. Build the summarization middleware factory

- [ ] 2.1 Create `src/provider/summarizationMiddleware.js` mirroring `src/provider/tokenBudgetMiddleware.js`'s shape, returning `createSummarizationMiddleware({ backend, trigger, keep, historyPathPrefix })` from `deepagents`, or `null` when `enabled` is false
- [ ] 2.2 Always pass `keep` explicitly (never rely on the library default of 20)
- [ ] 2.3 Add unit tests in `tests/unit/provider/summarizationMiddleware.test.js`: enabled config returns the middleware with configured trigger/keep, disabled config returns null, and trigger-without-keep still passes an explicit keep

## 3. Wire it into the orchestrator

- [ ] 3.1 In `src/agent/deepAgents.js`, insert the custom `SummarizationMiddleware` into the `middleware` array **before** `tokenBudgetMiddleware`, named exactly `SummarizationMiddleware` so the same-name merge displaces the library default
- [ ] 3.2 Spread it conditionally so unset config is a true no-op (today's behavior preserved)

## 4. Prove it fires at runtime (blocking acceptance criterion)

- [ ] 4.1 Add a runtime probe (log line or assertion) that shows compaction at the configured value, not the 170k default
- [ ] 4.2 Show the library default `SummarizationMiddleware` is genuinely absent from the effective stack
- [ ] 4.3 Verify the probe for the orchestrator **and** one subagent

## 5. Document and verify subagent behavior + offload scheme

- [ ] 5.1 Document and verify whether the custom middleware applies to subagents or only the orchestrator
- [ ] 5.2 Confirm the offload filename scheme empirically (write a transcript, inspect the sandbox filesystem) and record the confirmed scheme in docs/JSDoc

## 6. Verify

- [ ] 6.1 Run `npm run test`
- [ ] 6.2 Run `npm run lint`
- [ ] 6.3 Run `npm run coverage`
