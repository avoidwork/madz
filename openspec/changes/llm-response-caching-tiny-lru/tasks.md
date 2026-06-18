## 1. Setup

- [ ] 1.1 Add `tiny-lru` dependency to package.json
- [ ] 1.2 Create `src/cache/` directory structure
- [ ] 1.3 Create `src/cache/llm_cache.js` module skeleton

## 2. Configuration

- [ ] 2.1 Add `LruSchema` to `src/config/schemas.js` with `size` (default: 100) and `ttl` (default: 600000)
- [ ] 2.2 Add `lru` property to `ConfigSchema` in `src/config/schemas.js`
- [ ] 2.3 Add `lru` defaults to `DEFAULT_CONFIG` in `src/config/schemas.js`
- [ ] 2.4 Verify config validation passes with default and custom lru values

## 3. Cache Module Implementation

- [ ] 3.1 Implement `createLlmCache(size, ttl)` factory function in `src/cache/llm_cache.js`
- [ ] 3.2 Implement `getCacheKey(threadId, message)` using `node:crypto` SHA-256 hashing
- [ ] 3.3 Implement `cache.get(key)` — return cached response or null
- [ ] 3.4 Implement `cache.set(key, value)` — store response with TTL
- [ ] 3.5 Implement LRU eviction when cache size limit is reached
- [ ] 3.6 Implement TTL expiration — expired entries return null on get
- [ ] 3.7 Implement fail-open error handling — cache operations never throw

## 4. Integration with LLM Invocation Layer

- [ ] 4.1 Import cache module into `src/agent/react.js`
- [ ] 4.2 Pass config (including `config.lru`) to cache initialization
- [ ] 4.3 Wrap `callReactAgent()` with cache-aside pattern: check cache before invoke, store on miss
- [ ] 4.4 Wrap `callReactAgentStreaming()` with cache-aside pattern: check before stream, store final response after completion
- [ ] 4.5 Extract `thread_id` from `config.configurable` for cache key generation
- [ ] 4.6 Handle missing/null `thread_id` gracefully (skip caching or use fallback)
- [ ] 4.7 For streaming: aggregate all text chunks, cache only after successful completion
- [ ] 4.8 For streaming: do not cache if stream fails or is aborted

## 5. Testing

- [ ] 5.1 Create `tests/unit/cache/llm_cache.test.js`
- [ ] 5.2 Test cache hit returns cached response
- [ ] 5.3 Test cache miss returns null
- [ ] 5.4 Test cache key generation produces consistent hashes
- [ ] 5.5 Test TTL expiration — entry not returned after TTL
- [ ] 5.6 Test LRU eviction — least recently used entry evicted when full
- [ ] 5.7 Test fail-open — cache errors don't throw
- [ ] 5.8 Test integration with `callReactAgent()` — cache wraps invoke correctly
- [ ] 5.9 Test integration with `callReactAgentStreaming()` — cache wraps stream correctly
- [ ] 5.10 Test streaming cache stores final aggregated response, not chunks

## 6. Verification

- [ ] 6.1 Run existing test suite: `npm run test`
- [ ] 6.2 Run lint: `npm run lint`
- [ ] 6.3 Run coverage: `npm run coverage`
- [ ] 6.4 Verify all existing tests still pass
- [ ] 6.5 Verify lint passes with no errors
- [ ] 6.6 Verify coverage is maintained (no significant regression)