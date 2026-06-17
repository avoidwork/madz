## 1. Setup

- [ ] 1.1 Add tiny-lru to package.json dependencies via npm install
- [ ] 1.2 Create src/cache/ directory structure
- [ ] 1.3 Verify package.json includes tiny-lru in dependencies

## 2. LRU Cache Module

- [ ] 2.1 Create src/cache/lru.js with lru() factory wrapper
- [ ] 2.2 Read config.lru.size (default 100) and config.lru.ttl (default 600000) from application config
- [ ] 2.3 Export configured LRU instance from the module
- [ ] 2.4 Handle missing config.lru gracefully with defaults
- [ ] 2.5 Create src/cache/lru.test.js with unit tests for cache module

## 3. Cache Key Generation

- [ ] 3.1 Implement cache key generation function using threadId and SHA-256 hash of message content
- [ ] 3.2 Key format: `${threadId}_${sha256hex(message)}`
- [ ] 3.3 Write unit tests for cache key generation (deterministic, collision-resistant)

## 4. Non-Streaming Cache Integration

- [ ] 4.1 Import cache module into src/agent/react.js
- [ ] 4.2 Add cache check before agent.invoke() in callReactAgent()
- [ ] 4.3 On cache hit: return cached response immediately
- [ ] 4.4 On cache miss: call LLM, store response in cache, return response
- [ ] 4.5 Ensure cached response preserves full response shape including metadata

## 5. Streaming Cache Integration

- [ ] 5.1 Add cache check before agent.streamEvents() in callReactAgentStreaming()
- [ ] 5.2 On cache hit: return cached response without initiating stream
- [ ] 5.3 On cache miss: stream normally, aggregate full response
- [ ] 5.4 After successful stream completion: store aggregated response in cache
- [ ] 5.5 On stream failure/interruption: do not store in cache

## 6. Configuration

- [ ] 6.1 Add lru.size and lru.ttl to application config schema
- [ ] 6.2 Set default values: size=100, ttl=600000 (10 minutes)
- [ ] 6.3 Verify config is passed to cache module at bootstrap

## 7. Testing

- [ ] 7.1 Test cache hit returns cached response without calling LLM
- [ ] 7.2 Test cache miss calls LLM and stores result
- [ ] 7.3 Test streaming cache hit skips stream
- [ ] 7.4 Test streaming cache miss stores aggregated response
- [ ] 7.5 Test TTL expiration removes entries
- [ ] 7.6 Test LRU eviction when cache size limit is reached
- [ ] 7.7 Test cache key consistency for identical inputs
- [ ] 7.8 Test cache key differs for different threadId or message content
- [ ] 7.9 Add integration tests to src/agent/react.test.js

## 8. Verification

- [ ] 8.1 Run full test suite: npm run test
- [ ] 8.2 Run lint: npm run lint
- [ ] 8.3 Run coverage: npm run coverage
- [ ] 8.4 Verify all existing tests still pass
- [ ] 8.5 Verify cache works transparently across all providers