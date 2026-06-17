## Context

The madz agent system makes LLM calls through `src/agent/react.js`, which wraps multiple providers (OpenAI, Anthropic, etc.) via LangChain. Currently, every identical or near-identical prompt results in a full API call, wasting tokens, increasing latency, and inflating costs. There is no caching layer at the agent invocation level.

The system uses an agent factory pattern where `callReactAgent()` (non-streaming) and `callReactAgentStreaming()` (streaming) are the two entry points for LLM calls. Both receive `config` with `configurable.thread_id` and message content, making them ideal candidates for cache key generation.

## Goals / Non-Goals

**Goals:**
- Eliminate redundant LLM calls for identical prompts within the same thread
- Provide transparent caching that works for all providers without provider-specific changes
- Support both streaming and non-streaming call patterns
- Allow configurable cache size and TTL via application config
- Maintain fail-open behavior — if cache fails, LLM is called directly

**Non-Goals:**
- Semantic/similarity-based caching (e.g., caching near-duplicate prompts)
- Distributed caching (Redis, etc.) — stays in-memory
- Cache invalidation beyond TTL expiration
- Caching of streaming chunks — only full aggregated responses are cached

## Decisions

### 1. Use tiny-lru for in-memory LRU caching
**Rationale:** tiny-lru is lightweight (~2.2KB gzipped), has O(1) operations, supports TTL natively, and has zero dependencies. It's already used elsewhere in the codebase (issue #302 references it). The `lru(max, ttl)` factory function provides exactly what we need.

**Alternatives considered:**
- `lru-cache` package — heavier (~12KB), more complex API
- Custom Map with TTL — reinventing the wheel, no eviction strategy
- External cache (Redis) — adds infrastructure dependency for a local problem

### 2. Cache-aside pattern at the agent invocation layer
**Rationale:** Placing cache logic in `src/agent/react.js` (above provider code) means:
- All providers benefit automatically
- No changes needed to individual provider implementations
- Cache is provider-agnostic
- Simple fail-open: if cache check fails, proceed with LLM call

**Alternatives considered:**
- Write-through cache — more complex, risk of stale writes
- Cache in provider layer — would require changes to each provider

### 3. SHA-256 hash of message content for cache keys
**Rationale:** SHA-256 is fast, collision-resistant, and produces consistent hex strings. The key format `${threadId}_${hash}` ensures:
- Same prompt in same thread = same cache key
- Same prompt in different threads = different cache keys
- Compact storage (64-char hex digest)

**Alternatives considered:**
- MD5 — faster but weaker collision resistance (not a security concern, but SHA-256 is standard)
- Full prompt string as key — too long, not normalized

### 4. Cache full aggregated response after streaming completes
**Rationale:** Streaming calls produce chunks over time. Caching individual chunks would be complex and error-prone. Instead:
- Check cache before stream begins (same as non-streaming)
- On miss, stream normally and aggregate the full response
- After stream completes successfully, store the full response in cache
- This ensures cached values are complete, consistent response objects

### 5. Default TTL of 10 minutes, configurable via `config.lru.ttl`
**Rationale:** 10 minutes aligns with typical conversation thread lifespans. Short enough to avoid serving stale responses for long periods, long enough to capture repeated prompts within a conversation. Default size of 100 entries balances memory usage with hit rate.

## Risks / Trade-offs

### [Risk] Cached responses may become stale if model behavior changes
**Mitigation:** 10-minute TTL ensures responses are refreshed relatively frequently. Configurable TTL allows operators to adjust based on their needs.

### [Risk] Large messages may produce slow hashes
**Mitigation:** SHA-256 is fast even for large inputs (typically <1ms for messages under 10KB). The hash is computed once per call, not per chunk.

### [Risk] Cache misses on streaming calls add latency
**Mitigation:** The cache check happens before the stream begins and is O(1). A cache miss simply proceeds with the normal LLM call — no additional latency.

### [Risk] Cached response shape may not match live response shape
**Mitigation:** Store the full response object as returned by the LLM provider, including all metadata (token counts, finish reasons, etc.). This ensures downstream code receives identical data regardless of cache hit/miss.

### [Trade-off] No semantic similarity caching
**Acceptance:** Exact-match caching is simpler, faster, and covers the most common case (repeated prompts). Semantic caching would require embedding models and vector search, significantly increasing complexity and latency.

### [Trade-off] In-memory only
**Acceptance:** For most use cases, in-memory caching provides sufficient hit rates. If distributed caching becomes necessary, the architecture can be extended later without changing the cache-aside pattern.

## Open Questions

1. Should we expose cache statistics (hits, misses, size) via a TUI command or API endpoint?
2. Should we add a `resetTtl` option (reset TTL on update) for certain cache entries?
3. Should we log cache hits/misses for observability?