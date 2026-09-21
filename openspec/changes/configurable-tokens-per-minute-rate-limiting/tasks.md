## 1. Add Config Field

- [ ] 1.1 Add `maxTokensMinute` to `RateLimitSchema` in `src/config/schemas/providers.js` as `z.number().int().min(0).default(0)`
- [ ] 1.2 Update JSDoc in `src/provider/openai.js` to document `rateLimit.maxTokensMinute`

## 2. Build Rolling Token Window

- [ ] 2.1 Create `src/provider/tokenBudget.js` with a rolling 60-second window
- [ ] 2.2 Implement `consume(tokens)` to record a token consumption entry with timestamp
- [ ] 2.3 Implement `current()` to evict entries older than 60 seconds and return the sum
- [ ] 2.4 Implement `waitForCapacity(estimatedTokens)` to resolve once the window has room, delaying when near capacity

## 3. Wire Throttle into Dispatch

- [ ] 3.1 In `createChatModel()` in `src/provider/openai.js`, when `maxTokensMinute > 0`, estimate request token cost (input via `calculateConversationTokens` + `maxTokens` output budget)
- [ ] 3.2 `await waitForCapacity(estimatedCost)` then `consume(estimatedCost)` before invoking the model
- [ ] 3.3 Attribute `429` rate-limit errors to an exceeded token budget when the rolling window exceeds `maxTokensMinute`

## 4. Config & Documentation

- [ ] 4.1 Add `maxTokensMinute: 100000` example under `providers.openai.rateLimit` in `config.yaml`

## 5. Add Unit Tests

- [ ] 5.1 Create `tests/unit/provider/tokenBudget.test.js` covering window eviction after 60s
- [ ] 5.2 Test disabled path (`maxTokensMinute: 0`)
- [ ] 5.3 Test exactly-at-limit behavior
- [ ] 5.4 Test single request larger than the whole budget
- [ ] 5.5 Test rapid successive requests

## 6. Verify

- [ ] 6.1 Run `npm run test` — all tests pass
- [ ] 6.2 Run `npm run lint` — no lint errors
- [ ] 6.3 Run `npm run coverage` — coverage report generated successfully
