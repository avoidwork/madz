## 1. Fix encoder resolution (token-estimation)

- [ ] 1.1 Add an `ENCODING_TO_MODEL` map (e.g. `cl100k_base` → `gpt-4o`, `o200k_base` → `gpt-4o`,
      `p50k_base` → `gpt-3.5-turbo`) in `src/tui/contextTokens.js`
- [ ] 1.2 Rewrite encoder resolution in `calculateConversationTokens`: for an explicit encoding (param or
      `OPENAI_ENCODING`), use `tiktoken.get_encoding(encoding)` directly; otherwise derive the model name (strip
      `:version`) and use `tiktoken.encoding_for_model(modelName)`
- [ ] 1.3 Ensure the char/4 fallback is used only when tiktoken is unavailable or no encoder can be resolved
- [ ] 1.4 Add unit tests in `tests/unit/tui/contextTokens.test.js` asserting a known model/encoding returns a
      tiktoken count that differs from the char/4 estimate

## 2. Add atomic reserve + reconcile + release (provider-token-budget)

- [ ] 2.1 Add a promise-chain lock to `createTokenBudget` in `src/provider/tokenBudget.js`
- [ ] 2.2 Implement `reserve(estimatedTokens)` that atomically waits for capacity and records the entry under the
      lock, returning a handle
- [ ] 2.3 Implement `reconcile(handle, actualTokens)` that adjusts the entry identified by the handle to the real
      total
- [ ] 2.4 Implement `release(handle)` that removes the entry identified by the handle
- [ ] 2.5 Keep `consume`, `current`, and `waitForCapacity` working (backward compatible); make `consume` route
      through the same lock
- [ ] 2.6 Add unit tests in `tests/unit/provider/tokenBudget.test.js` for concurrent `reserve` not overshooting,
      `reconcile` adjusting up and down, and `release` removing an entry

## 3. Hoist a single shared budget (provider-token-budget)

- [ ] 3.1 Add a module-level shared budget singleton in `src/provider/openai.js` (lazily created, keyed by
      `maxTokensMinute`) with an exported `resetTokenBudget()` for tests
- [ ] 3.2 Export `getSharedTokenBudget` for use by the middleware
- [ ] 3.3 Add a unit test asserting two `createChatModel` instances with the same `maxTokensMinute` share one
      window

## 4. Implement the TokenBudget middleware (provider-token-budget)

- [ ] 4.1 Create `src/provider/tokenBudgetMiddleware.js` exporting a factory that returns
      `createMiddleware({ name: "TokenBudget", wrapModelCall })` from `langchain`
- [ ] 4.2 Estimate cost from `request.messages`, `request.systemMessage`, and `request.tools` (replaces the
      `normalizeMessages` shim in `openai.js`)
- [ ] 4.3 `reserve(estimate)` before `handler(request)`; on success `reconcile(handle, readUsageTokens(result))`;
      on throw `release(handle)`
- [ ] 4.4 On a 429: release, sleep for `retry-after`/default, `waitForCapacity` again, re-dispatch; charge only
      the successful attempt; log as exceeded token budget when `current()` exceeds `maxTokensMinute`
- [ ] 4.5 No-op pass-through to `handler(request)` when `maxTokensMinute` is `0`
- [ ] 4.6 Move `readUsageTokens` out of `openai.js` into the middleware module (or a shared helper) and update its
      tests

## 5. Remove the orphaned wrapper (provider-rate-limit-config)

- [ ] 5.1 Delete the `wrapDispatch` block from `createChatModel` in `src/provider/openai.js`
- [ ] 5.2 Delete the `_rawInvoke` / `_rawStream` test hooks
- [ ] 5.3 Update `createChatModel` JSDoc: state that `maxTokensMinute` is enforced by `TokenBudgetMiddleware`, and
      that `maxConcurrency` is passed through but does not bound what the budget sees
- [ ] 5.4 Delete the now-obsolete wrapper tests from `tests/unit/provider/openai.test.js`

## 6. Register the middleware (provider-token-budget)

- [ ] 6.1 In `src/agent/deepAgents.js`, append the `TokenBudget` middleware to the existing
      `createDeepAgent({ middleware: [...] })` array, **last** so it composes innermost (closest to the real
      dispatch)
- [ ] 6.2 Construct it from `providerConfig.rateLimit.maxTokensMinute`

## 7. Regression test that cannot pass trivially (provider-token-budget)

- [ ] 7.1 Add `tests/unit/provider/tokenBudgetMiddleware.test.js` driving a real `createAgent` with a stubbed
      transport, asserting `budget.current()` changes after `agent.invoke(...)`
- [ ] 7.2 Assert the middleware fires even though `AgentNode` calls `bindTools()` first — the exact condition the
      previous implementation failed
- [ ] 7.3 Assert middleware ordering: `TokenBudget` is innermost among `wrapModelCall` middleware
- [ ] 7.4 Assert a subagent dispatch charges the same shared window
- [ ] 7.5 Confirm the test FAILS if enforcement is moved back onto the model instance (temporarily revert step 5.1
      and verify red, then restore)

## 8. Verify

- [ ] 8.1 Run `npm run test` and fix any failures
- [ ] 8.2 Run `npm run lint` and fix any issues
- [ ] 8.3 Run `npm run coverage` and confirm coverage is maintained
- [ ] 8.4 Run `npm start` with a timeout to verify the app starts
- [ ] 8.5 Manually confirm with a low `maxTokensMinute` that a real multi-turn session visibly paces (the check
      that was inferred, not observed, the first time)
