## 1. Config Schema

- [ ] 1.1 Change `maxTokens` schema in `src/config/schemas/providers.js` from `z.number().int().positive().default(4096)` to `z.number().int().min(-1).default(-1)`
- [ ] 1.2 Update `config.yaml` `maxTokens: 4096` → `-1`

## 2. Model Client

- [ ] 2.1 In `src/provider/openai.js`, omit `maxTokens` from the `ChatOpenAI` opts when `config.maxTokens === -1`

## 3. Context Estimators

- [ ] 3.1 In `src/provider/tokenBudgetMiddleware.js`, normalize `-1` → `0` in `estimateContextCost`
- [ ] 3.2 In `src/tui/conversationArea.js`, normalize `-1` → `0` for `maxTokens`

## 4. 400 Detection & Compaction

- [ ] 4.1 Add a context-window error detector (status 400 + message pattern) in `src/provider/tokenBudgetMiddleware.js`
- [ ] 4.2 Add an `onContextWindowExceeded` callback option to `createTokenBudgetMiddleware` and invoke it (compact + re-send once) on a 400 context-window error
- [ ] 4.3 Wire the compaction callback in `src/agent/deepAgents.js` to call `agent.compactContext`

## 5. Tests

- [ ] 5.1 Add unit tests for the `-1` default/normalization in `tests/unit/provider/`
- [ ] 5.2 Add unit tests for the 400-triggers-compaction-and-retry path in `tests/unit/provider/`

## 6. Verification

- [ ] 6.1 Run `npm run test`
- [ ] 6.2 Run `npm run lint`
- [ ] 6.3 Run `npm run coverage`
