## 1. Extend RateLimitSchema

- [x] 1.1 Add `maxRetries` field to RateLimitSchema (int, 0-10, default: 6)
- [x] 1.2 Add `maxConcurrency` field to RateLimitSchema (int, 1+, optional)

## 2. Update createChatModel Factory

- [x] 2.1 Pass `maxRetries` from config to ChatOpenAI constructor
- [x] 2.2 Conditionally pass `maxConcurrency` when specified in config
- [x] 2.3 Update JSDoc to document new rateLimit properties

## 3. Add Unit Tests

- [x] 3.1 Test maxRetries passthrough to ChatOpenAI constructor
- [x] 3.2 Test default maxRetries (6) when not specified
- [x] 3.3 Test maxConcurrency passthrough when specified
- [x] 3.4 Test maxConcurrency omission when not specified

## 4. Config & Documentation

- [x] 4.1 Add `maxRetries` and `maxConcurrency` defaults to `config.yaml` under `providers.openai.rateLimit`
- [x] 4.2 Add `OPENAI_MAX_RETRIES` and `OPENAI_MAX_CONCURRENCY` to README.md environment variables table
- [x] 4.3 Update PR body to reflect config.yaml and README changes

## 5. Verify

- [x] 5.1 Run `npm run test` — all 1368 tests pass
- [x] 5.2 Run `npm run lint` — no lint errors
- [x] 5.3 Run `npm run coverage` — coverage report generated successfully
