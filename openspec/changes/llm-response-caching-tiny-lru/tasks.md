## 1. Setup

- [x] 1.1 Add `tiny-lru` dependency to package.json
- [x] 1.2 Create `src/cache/` directory structure
- [x] 1.3 Create `src/cache/llm_cache.js` module skeleton

## 2. Configuration

- [x] 2.1 Add `LruSchema` to `src/config/schemas.js` with `size` (default: 100) and `ttl` (default: 600000)
- [x] 2.2 Add `lru` property to `ConfigSchema` in `src/config/schemas.js`
- [x] 2.3 Add `lru` defaults to `DEFAULT_CONFIG` in `src/config/schemas.js`
- [x] 2.4 Verify config validation passes with default and custom lru values

## 3. Cache Module Implementation

- [x] 3.1 Implement `createLlmCache(size, ttl)` factory function in `src/cache/llm_cache.js`
- [x] 3.2 Implement `getCacheKey(threadId, message)` using `node:crypto` SHA-256 hashing
- [x] 3.3 Implement `cache.get(key)` — return cached response or null
- [x] 3.4 Implement `cache.set(key, value)` — store response with TTL
- [x] 3.5 Implement LRU eviction when cache size limit is reached
- [x] 3.6 Implement TTL expiration — expired entries return null on get
- [x] 3.7 Implement fail-open error handling — cache operations never throw

## 4. Integration with LLM Invocation Layer

- [x] 4.1 Import cache module into `src/agent/react.js`
- [x] 4.2 Pass config (including `config.lru`) to cache initialization
- [x] 4.3 Wrap `callReactAgent()` with cache-aside pattern: check cache before invoke, store on miss
- [x] 4.4 Wrap `callReactAgentStreaming()` with cache-aside pattern: check before stream, store final response after completion
- [x] 4.5 Extract `thread_id` from `config.configurable` for cache key generation
- [x] 4.6 Handle missing/null `thread_id` gracefully (skip caching or use fallback)
- [x] 4.7 For streaming: aggregate all text chunks, cache only after successful completion
- [x] 4.8 For streaming: do not cache if stream fails or is aborted

## 5. Testing

- [x] 5.1 Create `tests/unit/cache/llm_cache.test.js`
- [x] 5.2 Test cache hit returns cached response
- [x] 5.3 Test cache miss returns null
- [x] 5.4 Test cache key generation produces consistent hashes
- [x] 5.5 Test TTL expiration — entry not returned after TTL
- [x] 5.6 Test LRU eviction — least recently used entry evicted when full
- [x] 5.7 Test fail-open — cache errors don't throw
- [x] 5.8 Test integration with `callReactAgent()` — cache wraps invoke correctly
- [x] 5.9 Test integration with `callReactAgentStreaming()` — cache wraps stream correctly
- [x] 5.10 Test streaming cache stores final aggregated response, not chunks

## 6. Verification

- [x] 6.1 Run existing test suite: `npm run test`
- [x] 6.2 Run lint: `npm run lint`
- [x] 6.3 Run coverage: `npm run coverage`
- [x] 6.4 Verify all existing tests still pass
- [x] 6.5 Verify lint passes with no errors
- [x] 6.6 Verify coverage is maintained (no significant regression)