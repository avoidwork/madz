## 1. Config Schema

- [ ] 1.1 Create `src/config/schemas/summarization.js` exporting `SummarizationSchema`: `enabled` (`z.boolean().default(false)`), `trigger`, `keep`, and `truncateArgs` (`{ trigger, keep, maxLength }`). Use `z.enum(["tokens","messages"])` for `type` and `z.number().int()` for `value`. Do NOT use `.strict()` or `z.discriminatedUnion`. *(summarization-config: SummarizationSchema defines the summarization config section; Trigger and keep accept only tokens and messages types)*
- [ ] 1.2 Apply the bounds from design Decision 10: `trigger.value` min 2 / max 10000000; `keep.value` min 1 / max 10000000; `truncateArgs.trigger.value` and `truncateArgs.keep.value` min 1 / max 10000000; `truncateArgs.maxLength` min 1 / max 1000000. Reject, never clamp. *(summarization-config: Threshold values are validated and never clamped)*
- [ ] 1.3 Re-export `SummarizationSchema` from `src/config/schemas/index.js` as a named export (no wildcard export). *(summarization-config: Schema is re-exported from the barrel)*
- [ ] 1.4 Compose `summarization: SummarizationSchema.default({})` into `ConfigSchema` in `src/config/config.js`. Do NOT edit `src/config/loader.js` — `KNOWN_SECTIONS` and `syncEnv()` derive automatically. *(summarization-config: SummarizationSchema defines the summarization config section; Summarization thresholds support environment variable overrides)*

## 2. Middleware Factory

- [ ] 2.1 Create `src/provider/summarizationMiddleware.js` exporting `createSummarizationMiddleware(options)` that returns `null` when the section is absent or `enabled` is `false`, mirroring `src/provider/tokenBudgetMiddleware.js`. Import `createSummarizationMiddleware` from `deepagents` under an alias to avoid shadowing, and accept it as an injectable option (defaulting to the real import) because `mock.module()` is unavailable in this repo's test runner. Do NOT import `createMiddleware` from `langchain`. *(summarization-middleware: Summarization middleware factory returns null when disabled; The deepagents factory is injectable for tests; does not depend on undeclared packages)*
- [ ] 2.2 Always pass `keep` explicitly, defaulting to `{ type: "messages", value: 6 }`, to prevent the silent 6 → 20 drift from `DEFAULT_MESSAGES_TO_KEEP`. *(summarization-middleware: factory always passes keep explicitly)*
- [ ] 2.3 Always pass `truncateArgsSettings` explicitly, defaulting to `{ trigger: { type: "messages", value: 20 }, keep: { type: "messages", value: 20 }, maxLength: 2000 }`, to prevent truncation being silently disabled by the `applyModelDefaults()` early return. *(summarization-middleware: factory always passes tool-argument truncation settings explicitly)*
- [ ] 2.4 Ensure the returned middleware keeps the exact name `SummarizationMiddleware` so `mergeMiddlewareStack()` replaces the library default in place. Do NOT add any `excludedMiddleware` entry. *(summarization-middleware: custom middleware replaces the library default by name)*
- [ ] 2.5 Add JSDoc on the factory documenting: the null-when-disabled contract, the explicit-`keep` and explicit-`truncateArgsSettings` rationale, the orchestrator-only boundary (subagents stay on library defaults), and the cost implication of an over-aggressive trigger. Use `src/shared/logger.js` for logging; no `console.` calls; no empty catch blocks. *(summarization-middleware: subagent coverage boundary is documented; Factory follows repository logging and error rules)*

## 3. Orchestrator Wiring

- [ ] 3.1 In `src/agent/deepAgents.js`, build the summarization middleware from `config.summarization` with the same `CompositeBackend` instance passed to `createDeepAgent()`, and spread it conditionally into the `middleware` array. *(summarization-middleware: Summarization middleware factory returns null when disabled)*
- [ ] 3.2 Insert the summarization entry BEFORE the conditional `tokenBudgetMiddleware` spread so `TokenBudget` remains the last entry and still composes innermost. Update the existing "Registered LAST" comment to reflect the new array contents. *(summarization-middleware: middleware ordering preserves the token-budget invariant)*
- [ ] 3.3 Confirm no change is made to the `registerHarnessProfile()` call at line ~153 in this change. *(summarization-middleware: no summarization middleware is excluded via harness profile)*
- [ ] 3.4 Add a startup `logger.debug` line recording the effective trigger and keep when summarization is enabled, using structured fields only. No message content, no API key, no base URL. *(summarization-config: Startup logging excludes secrets and message content)*

## 4. Config Example and Docs

- [ ] 4.1 Add an ACTIVE `summarization` block to `config.yaml` with `enabled: false` (matching how `maxTokensMinute: 0` was introduced), plus commented example values for `trigger`, `keep`, and `truncateArgs` and a note on the cost of an over-aggressive trigger. No internal hostnames or vendor-internal model identifiers. *(summarization-config: Summarization section is documented in config.yaml)*
- [ ] 4.2 Record the empirically confirmed fallback values (170,000-token trigger, keep 6, truncation on) in JSDoc or docs, and state that the offload filename scheme is unverified. *(summarization-config: documented fallback values are recorded)*

## 5. Schema Unit Tests

- [ ] 5.1 Create `tests/unit/config/summarization.test.js` mirroring the style of `tests/unit/config/providers.test.js` (`node:test` + `node:assert`, `describe`/`test`). *(summarization-config: all requirements)*
- [ ] 5.2 Test valid `tokens` and `messages` triggers/keep round-trip unchanged, and that `fraction` and unknown types are rejected. *(summarization-config: Trigger and keep accept only tokens and messages types)*
- [ ] 5.3 Test rejection of zero, negative, non-integer, and non-numeric values; rejection at `trigger.value` 1 and 10000001; acceptance at `trigger.value` 2, `keep.value` 1, and `trigger.value` 1000000. *(summarization-config: Threshold values are validated and never clamped)*
- [ ] 5.4 Test that an absent section parses to `enabled: false`, and that an unknown key is stripped without failing validation while an invalid known key still fails. *(summarization-config: section absent resolves to documented defaults; unknown keys follow the existing config convention)*
- [ ] 5.5 Test that `KNOWN_SECTIONS` includes `summarization`, that `SUMMARIZATION_*` env vars materialize the section, and that no summarization path is dropped by `DROPPED_KEYS`. *(summarization-config: Summarization thresholds support environment variable overrides)*
- [ ] 5.6 Test that credential-shaped keys (`apiKey`, `base_url`) placed under `summarization` are stripped and never reach the middleware factory, and that startup logging carries only trigger/keep fields. *(summarization-config: Summarization section carries no credentials and logs no secrets)*

## 6. Factory Unit Tests

- [ ] 6.1 Create `tests/unit/provider/summarizationMiddleware.test.js` following `tests/unit/provider/tokenBudgetMiddleware.test.js`. *(summarization-middleware: all requirements)*
- [ ] 6.2 Test `null` return for `enabled: false` and for an empty/missing config; test a middleware object is returned when enabled with a backend. *(summarization-middleware: Summarization middleware factory returns null when disabled)*
- [ ] 6.3 Test the returned middleware `name` is exactly `SummarizationMiddleware`. *(summarization-middleware: custom middleware replaces the library default by name)*
- [ ] 6.4 Test that `keep` is always forwarded, defaulting to `{ type: "messages", value: 6 }`, and that an explicit `keep` is forwarded unchanged — use the injected factory to capture options. *(summarization-middleware: factory always passes keep explicitly; The deepagents factory is injectable for tests)*
- [ ] 6.5 Test that `truncateArgsSettings` is always forwarded with the documented defaults, and that explicit config overrides them — use the injected factory to capture options. *(summarization-middleware: factory always passes tool-argument truncation settings explicitly; The deepagents factory is injectable for tests)*
- [ ] 6.6 Test the module has no `langchain` import and no `console.` usage. *(summarization-middleware: Factory does not depend on undeclared packages; Factory follows repository logging and error rules)*
- [ ] 6.7 Test that a trigger above the model's real window and a `keep` at or above the live message count degrade predictably: no error is thrown, and the cutoff is a no-op. *(summarization-middleware: out-of-range thresholds degrade predictably)*
- [ ] 6.8 Test that a configured proactive trigger does not disable the reactive overflow path, and that a reliably-firing proactive trigger leaves the estimation multiplier at 1. *(summarization-middleware: proactive trigger coexists with reactive calibration)*

## 7. Runtime Proof (blocking acceptance criterion)

- [ ] 7.1 Extend `tests/unit/deepAgents.test.js` (or a new `tests/unit/agent/` test) to assert on the EFFECTIVE middleware stack read from the constructed agent (`agent.options.middleware`), not on factory call arguments. No real API calls — stub the provider. *(summarization-middleware: compaction firing is proven at runtime, not at construction)*
- [ ] 7.2 With summarization enabled, assert exactly one entry named `SummarizationMiddleware` exists in the effective stack and that it is the madz-produced instance, not the library default. *(summarization-middleware: effective stack holds exactly one summarization middleware; custom instance is the one that survives)*
- [ ] 7.3 Assert `TokenBudget` appears after `SummarizationMiddleware` and `CodeInterpreterMiddleware` is still present. *(summarization-middleware: middleware ordering preserves the token-budget invariant)*
- [ ] 7.4 With summarization disabled, assert the effective stack still contains exactly one `SummarizationMiddleware` and that it is the library default (no madz entry was added). *(summarization-config: unset summarization config preserves current behavior)*
- [ ] 7.5 Assert the subagent boundary: document in a test comment that subagent stacks are built lazily inside `subAgentMiddleware.wrapToolCall` and are not statically observable, and that subagents remain on library defaults. *(summarization-middleware: subagent coverage boundary is documented)*

## 8. Verify

- [ ] 8.1 Run `npm run test` — all tests pass, no regression from the 3817-test baseline
- [ ] 8.2 Run `npm run lint` — no lint errors
- [ ] 8.3 Run `npm run coverage` — coverage maintained
- [ ] 8.4 Confirm no `src/` change was made to `src/provider/openai.js` (no `profile` assignment) and that `excludedMiddleware` was not introduced
