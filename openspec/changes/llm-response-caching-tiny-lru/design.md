## Context

The madz project uses LangChain's LangGraph to power a ReAct agent that makes LLM calls through `src/agent/react.js`. Currently, every unique prompt results in a full LLM API call, even if the exact same prompt has been asked before in the same or different threads. This leads to wasted tokens, increased latency, and higher costs for repeated queries.

The project has no existing caching mechanism for LLM responses. Configuration is managed through `src/config/schemas.js` using Zod schemas, and the LLM invocation layer consists of two main functions: `callReactAgent()` for non-streaming calls and `callReactAgentStreaming()` for streaming calls.

## Goals / Non-Goals

**Goals:**
- Eliminate redundant LLM API calls for identical prompts within a configurable time window
- Provide immediate responses for cached prompts without latency
- Reduce token consumption and API costs for repeated queries
- Implement a transparent, fail-open caching layer that doesn't block LLM calls
- Support both streaming and non-streaming LLM invocation patterns

**Non-Goals:**
- Semantic/similarity-based caching (future enhancement)
- External cache backends (Redis, Memcached, etc.)
- Cache invalidation beyond TTL and size limits
- Caching at the provider level (belongs at agent call layer)
- Multi-instance cache sharing (in-memory only)

## Decisions

1. **Cache-aside pattern over write-through/write-behind**
   - Rationale: Cache-aside keeps the LLM path simple and fail-open. If the cache fails, the LLM call proceeds normally. Write-through would add complexity and potential failure points to every LLM call.
   - Alternatives considered: Write-through (adds write path complexity), Write-behind (adds eventual consistency concerns)

2. **Agent layer integration over provider layer**
   - Rationale: Caching at `src/agent/react.js` ensures all providers benefit transparently. The provider layer (`src/provider/openai.js`) is a thin wrapper around LangChain and doesn't have the context needed for cache key generation (thread_id, message content).
   - Alternatives considered: Provider-level caching (would require changes to each provider), Agent factory-level caching (less flexible, harder to configure)

3. **In-memory LRU over external cache**
   - Rationale: `tiny-lru` provides bounded memory usage with LRU eviction, avoiding infrastructure dependencies. The project's scope doesn't justify Redis/Memcached for a single-instance deployment.
   - Alternatives considered: Redis (adds infrastructure), Node.js Map (unbounded memory growth)

4. **SHA-256 hashing for cache keys**
   - Rationale: `node:crypto` is built-in, SHA-256 provides collision resistance, and hashing keeps key storage minimal. The hash is computed from message content, ensuring identical inputs produce identical keys.
   - Alternatives considered: MD5 (weaker collision resistance), full prompt storage (larger keys, more memory)

5. **Streaming: cache final response, not chunks**
   - Rationale: Streaming clients need either the full cached response or a fresh stream. Caching individual chunks would be complex and inconsistent. The cache check happens before the stream begins; the store happens after successful completion.
   - Alternatives considered: Cache chunks (complex, inconsistent), cache partial responses (risky)

6. **Fail-open design**
   - Rationale: Cache operations never block or fail LLM calls. If cache retrieval fails, the LLM is called normally. If cache storage fails after an LLM call, the response is still returned to the client.
   - Alternatives considered: Fail-closed (blocks user on cache failure), Fail-silent (harder to debug)

## Risks / Trade-offs

1. **[Risk] Memory impact from cached responses** → [Mitigation] LRU eviction bounded by `lru.size` (default 100 entries). Each entry stores full LLM responses, but the bound prevents unbounded growth.

2. **[Risk] Cache key collisions** → [Mitigation] SHA-256 collision probability is negligible. Even if a collision occurs, the worst case is returning an incorrect cached response, which is rare and short-lived (TTL-bound).

3. **[Risk] Thread ID extraction failures** → [Mitigation] Handle missing/null `thread_id` gracefully — either skip caching or use a fallback key. Never throw errors that block LLM calls.

4. **[Risk] Streaming cache inconsistency** → [Mitigation] Cache store only happens after successful stream completion. If stream fails, no partial response is cached. Cache check happens before stream begins.

5. **[Risk] TTL expiration mid-stream** → [Mitigation] TTL only affects cache lookups, not in-progress streams. An entry expiring during a stream doesn't affect the current stream's outcome.

6. **[Trade-off] Exact-match only** → Users won't get cached responses for similar (but not identical) prompts. This is acceptable for the initial implementation; semantic caching can be added later.

## Migration Plan

This is an additive change with no breaking changes. The implementation:
1. Adds `tiny-lru` dependency (non-breaking)
2. Adds new `lru` config section with sensible defaults (non-breaking)
3. Wraps existing LLM call functions with cache logic (transparent, fail-open)

No migration steps required. Existing configurations continue to work. The cache is disabled by default (no entries until prompts are seen), and defaults can be tuned via config.

## Open Questions

1. Should the cache key include system prompt content? Currently the plan is to hash only the user message content. If system prompts vary, identical user messages with different system prompts would share cache entries. This may be acceptable for most use cases but could be refined later.

2. Should there be a way to programmatically clear the cache? Not required for v1, but could be added as a config method if needed.