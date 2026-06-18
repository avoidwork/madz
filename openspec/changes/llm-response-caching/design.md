## Context

The current LLM invoke layer in `src/agent/react.js` calls the model for every request without any caching. This results in redundant API calls for identical or near-identical prompts, wasting tokens, increasing latency, and inflating costs. The system is single-threaded Node.js, which simplifies cache consistency concerns.

## Goals / Non-Goals

**Goals:**
- Eliminate redundant LLM calls for previously seen inputs within conversation threads
- Provide immediate responses for cached inputs without API latency
- Reduce token usage and API costs for repeated prompts
- Implement transparent caching that works for both streaming and non-streaming calls
- Maintain fail-open behavior: cache failures never block the LLM call path

**Non-Goals:**
- Semantic/similarity-based caching (would require embedding models)
- Distributed cache across multiple instances (single-threaded Node.js)
- Cache warming or pre-computation
- Cache analytics or monitoring (future enhancement)
- Write-through or write-behind caching strategies

## Decisions

### Decision 1: Cache-aside pattern over write-through/write-behind
**Choice:** Cache-aside (check cache before call, store on miss)
**Rationale:** Keeps the LLM path simple and fail-open. On cache miss, the normal flow proceeds unchanged. On cache hit, the response is returned immediately. Write-through would require modifying the LLM provider layer; write-behind adds complexity around consistency and error handling.
**Alternatives considered:**
- Write-through: Would require caching after every LLM call, adding overhead to every request even on cache hits
- Write-behind: Would require async cache writes with retry logic, adding complexity and potential inconsistency

### Decision 2: In-memory LRU cache (tiny-lru) over external cache (Redis/Memcached)
**Choice:** In-memory LRU cache using `tiny-lru`
**Rationale:** The system is single-threaded Node.js, so no distributed consistency concerns exist. Redis/Memcached adds infrastructure complexity for a problem solvable locally. The cache is thread-local, making in-memory the simplest and fastest option.
**Alternatives considered:**
- Redis: Would require additional infrastructure, network latency, and serialization
- Memcached: Same infrastructure concerns as Redis
- In-memory Map: No built-in TTL or LRU eviction, requiring manual management

### Decision 3: SHA-256 hashing for cache keys
**Choice:** `node:crypto.createHash('sha256')` for hash computation
**Rationale:** SHA-256 provides collision-resistant keys with minimal storage overhead. The hash is computed from the message content, ensuring identical inputs produce identical keys. MD5 would be faster but has known collision vulnerabilities; SHA-1 is deprecated. SHA-256 provides a good balance of security and performance for this use case.
**Alternatives considered:**
- MD5: Faster but cryptographically broken (not relevant here, but SHA-256 is the modern standard)
- SHA-1: Deprecated, potential collision issues
- Base64 encoding: Larger key size, no collision resistance

### Decision 4: Cache key format `threadId_<hash>`
**Choice:** Cache keys follow the format `${threadId}_${hash}` where hash is computed from message content
**Rationale:** Thread isolation is critical — identical prompts in different threads should not share cache entries. The thread ID is extracted from `config.configurable.thread_id` which is already available in the LLM invoke layer. The hash provides compact, collision-resistant keys while preserving thread isolation.
**Alternatives considered:**
- Hash of threadId + message: Would mix thread context into the hash, making keys less readable and potentially less efficient for LRU eviction
- Separate cache per thread: Would require managing multiple cache instances, adding complexity

### Decision 5: Fail-open cache behavior
**Choice:** Cache operations are wrapped in try/catch; any error falls through to normal LLM call
**Rationale:** The cache is a performance optimization, not a correctness requirement. Users should never experience degraded functionality due to cache failures. Fail-open ensures the system remains functional even if the cache becomes corrupted or unavailable.
**Alternatives considered:**
- Fail-closed: Would block user requests on cache errors, degrading UX
- Partial fail-open: Would require complex error handling logic, adding maintenance burden

## Risks / Trade-offs

### Risk: Memory growth with large conversation threads
**Mitigation:** LRU eviction with configurable size limit (default 100 entries). TTL cleanup removes stale entries. Memory usage is bounded by `lru.size * average_response_size`.

### Risk: Cache key collisions
**Mitigation:** SHA-256 provides collision-resistant keys. The probability of collision is negligible for practical purposes. Thread isolation further reduces collision risk.

### Risk: Stale cached responses
**Mitigation:** TTL of 10 minutes aligns with typical conversation thread lifespans. If model behavior changes, stale entries will naturally expire within 10 minutes. For immediate invalidation, the cache size limit ensures old entries are evicted as new ones are added.

### Risk: Streaming cache complexity
**Mitigation:** Cache check happens before stream begins. Aggregated result is stored after stream completes successfully. Individual chunks are never cached, avoiding partial/corrupted cache entries.

### Trade-off: Exact-match only (no semantic caching)
**Rationale:** Semantic caching would require embedding models, vector search, and significantly higher complexity. Exact-match caching addresses the common case of repeated identical prompts efficiently. Semantic caching is a future enhancement if needed.

## Migration Plan

This is a new feature with no migration required. The cache is transparent and fail-open, so existing functionality is preserved on cache miss or error. No database migrations, configuration changes, or breaking changes are required.

1. Deploy the feature with default cache settings (size: 100, TTL: 10 minutes)
2. Monitor cache hit rates and memory usage
3. Adjust `lru.size` and `lru.ttl` based on observed usage patterns
4. No rollback required — cache can be disabled by setting `lru.size` to 0

## Open Questions

- Should cache hit/miss metrics be exposed for monitoring? (Future enhancement)
- Should the cache support manual invalidation (e.g., when model updates are deployed)? (Future enhancement)
- Is 10 minutes the optimal TTL for all use cases, or should it be configurable per-thread? (Current implementation uses global TTL)