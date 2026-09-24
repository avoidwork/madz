## 1. Extract shared context-cost helper (context-estimation)

- [x] 1.1 Add an exported `estimateContextCost(conversation, { model, encoding, maxTokens })` async function in `src/provider/tokenBudgetMiddleware.js` that returns `calculateConversationTokens(conversation, model, encoding) + (maxTokens || 0)`
- [x] 1.2 Refactor the middleware's internal `estimateCost` to delegate to `estimateContextCost`, preserving enforcement behavior
- [x] 1.3 Add unit tests in `tests/unit/provider/tokenBudgetMiddleware.test.js` for `estimateContextCost`: adds `maxTokens`, is callable without a budget, and the middleware delegates to it

## 2. Build full system prompt in updateContextSize (context-window-status)

- [x] 2.1 In `src/tui/conversationArea.js` `updateContextSize`, after `loadSystemPrompt()`, read `AGENTS.md` from `config.cwd` and append it with `"\n\n---\n\n"` (mirroring `createDeepAgentsOrchestrator`), skipping gracefully when the file is absent
- [x] 2.2 Add `maxTokens` from `providerConfig` to the context count, matching the middleware's `estimateCost`
- [x] 2.3 Add coverage in `tests/unit/tui/conversationArea.test.js` verifying `updateContextSize` includes AGENTS.md and `maxTokens`

## 3. Verify

- [x] 3.1 Run `npm run test` and fix any failures
- [x] 3.2 Run `npm run lint` and fix any issues
- [x] 3.3 Run `npm run coverage` and confirm coverage is maintained
