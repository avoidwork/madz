## 1. Fix encoder resolution (token-estimation)

- [ ] 1.1 Add an `ENCODING_TO_MODEL` map (e.g. `cl100k_base` → `gpt-4o`, `o200k_base` → `gpt-4o`, `p50k_base` → `gpt-3.5-turbo`) in `src/tui/contextTokens.js`
- [ ] 1.2 Rewrite encoder resolution in `calculateConversationTokens`: for an explicit encoding (param or `OPENAI_ENCODING`), use `tiktoken.get_encoding(encoding)` directly; otherwise derive the model name (strip `:version`) and use `tiktoken.encoding_for_model(modelName)`
- [ ] 1.3 Ensure the char/4 fallback is used only when tiktoken is unavailable or no encoder can be resolved
- [ ] 1.4 Add unit tests in `tests/unit/tui/contextTokens.test.js` asserting a known model/encoding returns a tiktoken count that differs from the char/4 estimate

## 2. Add atomic reserve + reconcile + release (provider-token-budget)

- [ ] 2.1 Add a promise-chain lock to `createTokenBudget` in `src/provider/tokenBudget.js`
- [ ] 2.2 Implement `reserve(estimatedTokens)` that atomically waits for capacity and records the entry under the lock, returning a handle
- [ ] 2.3 Implement `reconcile(handle, actualTokens)` that adjusts the entry identified by the handle to the real total
- [ ] 2.4 Implement `release(handle)` that removes the entry identified by the handle
- [ ] 2.5 Keep `consume`, `current`, and `waitForCapacity` working (backward compatible); make `consume` route through the same lock
- [ ] 2.6 Add unit tests in `tests/unit/provider/tokenBudget.test.js` for concurrent `reserve` not overshooting, `reconcile` adjusting up and down, and `release` removing an entry

## 3. Hoist a single shared budget (provider-rate-limit-config)

- [ ] 3.1 Add a module-level shared budget singleton in `src/provider/openai.js` (lazily created, keyed by `maxTokensMinute`) with an exported `resetTokenBudget()` for tests
- [ ] 3.2 Change `createChatModel` to use the shared budget instead of constructing a per-instance `createTokenBudget`
- [ ] 3.3 Add a unit test asserting two `createChatModel` instances with the same `maxTokensMinute` share one window

## 4. Reconcile usage + charge only on success + re-pace retry (provider-rate-limit-config)

- [ ] 4.1 Add a `readUsageTokens(result)` helper in `src/provider/openai.js` that extracts prompt + completion tokens from an invoke/stream response (returns 0/undefined when absent)
- [ ] 4.2 Restructure the dispatch wrapper to `reserve` before dispatch, `reconcile` to actual usage on success, and `release` on failure
- [ ] 4.3 On a 429, release the failed attempt, sleep for `retry-after`/default, call `waitForCapacity` again, and re-dispatch; charge only the successful attempt
- [ ] 4.4 Update the `createChatModel` JSDoc to document that `maxConcurrency` is passed through but does not bound what the budget sees (shared budget is the enforcement point)
- [ ] 4.5 Add unit tests in `tests/unit/provider/` (or extend `tokenBudget.test.js`) covering: successful dispatch reconciles to actual usage, failed dispatch releases the reservation, and a 429 retry re-paces and charges only once

## 5. Verify

- [ ] 5.1 Run `npm run test` and fix any failures
- [ ] 5.2 Run `npm run lint` and fix any issues
- [ ] 5.3 Run `npm run coverage` and confirm coverage is maintained
- [ ] 5.4 Run `npm start` with a timeout to verify the app starts
