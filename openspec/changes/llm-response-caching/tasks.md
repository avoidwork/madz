## 1. Setup

- [ ] 1.1 Add tiny-lru dependency to package.json
- [ ] 1.2 Create src/cache/lru.js module with LRU cache factory
- [ ] 1.3 Export cache module from src/cache/index.js

## 2. Configuration

- [ ] 2.1 Add lru.size and lru.ttl to default configuration with defaults (100, 600000)
- [ ] 2.2 Wire lru config through app bootstrap to cache module
- [ ] 2.3 Add config validation for lru.size (positive integer) and lru.ttl (positive integer)

## 3. Cache Key Generation

- [ ] 3.1 Implement createCacheKey(threadId, messageContent) using node:crypto SHA-256
- [ ] 3.2 Ensure cache key format is threadId_<hash>
- [ ] 3.3 Write unit tests for cache key generation with various inputs

## 4. Non-Streaming Cache Integration

- [ ] 4.1 Wrap callReactAgent() with cache-aside pattern
- [ ] 4.2 Extract threadId from config.configurable.thread_id
- [ ] 4.3 Check cache before agent.invoke(), store on miss, return on hit
- [ ] 4.4 Handle cache errors gracefully (fail-open to normal LLM call)

## 5. Streaming Cache Integration

- [ ] 5.1 Wrap callReactAgentStreaming() with cache-aside pattern
- [ ] 5.2 Check cache before agent.streamEvents() begins
- [ ] 5.3 On cache hit, return cached response without starting stream
- [ ] 5.4 On cache miss, stream normally and aggregate result
- [ ] 5.5 Store aggregated result in cache after stream completes successfully
- [ ] 5.6 Ensure individual chunks are not cached

## 6. Fail-Open Error Handling

- [ ] 6.1 Wrap all cache read operations in try/catch
- [ ] 6.2 Wrap all cache write operations in try/catch
- [ ] 6.3 Ensure cache errors fall through to normal LLM call path
- [ ] 6.4 Add logging for cache errors (warn level, not error)

## 7. Testing

- [ ] 7.1 Write unit tests for cache key generation
- [ ] 7.2 Write unit tests for LRU cache module (size limit, TTL, eviction)
- [ ] 7.3 Write unit tests for non-streaming cache integration
- [ ] 7.4 Write unit tests for streaming cache integration
- [ ] 7.5 Write unit tests for fail-open error handling
- [ ] 7.6 Write integration tests for cache hit/miss scenarios
- [ ] 7.7 Verify all existing tests still pass

## 8. Verification

- [ ] 8.1 Run npm run test and verify all tests pass
- [ ] 8.2 Run npm run lint and verify no lint errors
- [ ] 8.3 Run npm run coverage and verify coverage is maintained
- [ ] 8.4 Manual testing: verify cache hits return immediately
- [ ] 8.5 Manual testing: verify cache misses call the LLM provider
- [ ] 8.6 Manual testing: verify streaming cache stores aggregated result