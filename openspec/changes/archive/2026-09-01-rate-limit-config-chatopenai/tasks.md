## 1. Extend RateLimitSchema

- [ ] 1.1 Add `maxRetries` field to RateLimitSchema (int, 0-10, default: 6)
- [ ] 1.2 Add `maxConcurrency` field to RateLimitSchema (int, 1+, optional)

## 2. Update createChatModel Factory

- [ ] 2.1 Pass `maxRetries` from config to ChatOpenAI constructor
- [ ] 2.2 Conditionally pass `maxConcurrency` when specified in config
- [ ] 2.3 Update JSDoc to document new rateLimit properties

## 3. Add Unit Tests

- [ ] 3.1 Test maxRetries validation (valid range 0-10, invalid values rejected)
- [ ] 3.2 Test maxConcurrency validation (optional, min 1, invalid values rejected)
- [ ] 3.3 Test createChatModel passes maxRetries to ChatOpenAI constructor
- [ ] 3.4 Test createChatModel passes maxConcurrency to ChatOpenAI constructor when specified
- [ ] 3.5 Test createChatModel omits maxConcurrency when not specified

## 4. Verify

- [ ] 4.1 Run `npm run test` — all tests pass
- [ ] 4.2 Run `npm run lint` — no lint errors
- [ ] 4.3 Run `npm run coverage` — coverage report generated successfully
