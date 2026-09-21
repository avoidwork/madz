## 1. Add Config Field

- [x] 1.1 Add `maxTokensMinute` to `RateLimitSchema` in `src/config/schemas/providers.js` as `z.number().int().min(0).default(0)`
- [x] 1.2 Update JSDoc in `src/provider/openai.js` to document `rateLimit.maxTokensMinute`

## 2. Build Rolling Token Window

- [x] 2.1 Create `src/provider/tokenBudget.js` with a rolling 60-second window
- [x] 2.2 Implement `consume(tokens)` to record a token consumption entry with timestamp
- [x] 2.3 Implement `current()` to evict entries older than 60 seconds and return the sum
- [x] 2.4 Implement `waitForCapacity(estimatedTokens)` to resolve once the window has room, delaying when near capacity

## 3. Wire Throttle into Dispatch

- [x] 3.1 In `createChatModel()` in `src/provider/openai.js`, when `maxTokensMinute > 0`, estimate request token cost (input via `calculateConversationTokens` + `maxTokens` output budget)
- [x] 3.2 `await waitForCapacity(estimatedCost)` then `consume(estimatedCost)` before invoking the model
- [x] 3.3 Attribute `429` rate-limit errors to an exceeded token budget when the rolling window exceeds `maxTokensMinute`

## 4. Config & Documentation

- [x] 4.1 Add `maxTokensMinute: 100000` example under `providers.openai.rateLimit` in `config.yaml`

## 5. Add Unit Tests

- [x] 5.1 Create `tests/unit/provider/tokenBudget.test.js` covering window eviction after 60s
- [x] 5.2 Test disabled path (`maxTokensMinute: 0`)
- [x] 5.3 Test exactly-at-limit behavior
- [x] 5.4 Test single request larger than the whole budget
- [x] 5.5 Test rapid successive requests

## 6. Verify

- [x] 6.1 Run `npm run test` — all tests pass
- [x] 6.2 Run `npm run lint` — no lint errors
- [x] 6.3 Run `npm run coverage` — coverage report generated successfully
