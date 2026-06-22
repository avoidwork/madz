## Why

Repeated identical or near-identical LLM prompts waste tokens, increase latency, and inflate costs. Caching LLM responses for previously seen inputs provides immediate replies, reduces API load, and improves overall system efficiency without requiring changes to user behavior.

## What Changes

- Add `tiny-lru` as a project dependency for in-memory LRU caching
- Introduce a new `lru` configuration section with `size` (default: 100) and `ttl` (default: 600000ms) properties
- Create a new cache module at `src/cache/llm_cache.js` implementing cache-aside pattern
- Hash prompt inputs using `node:crypto` for compact, collision-resistant cache keys
- Integrate caching into both `callReactAgent()` and `callReactAgentStreaming()` in `src/agent/react.js`
- Cache keys follow format `${threadId}_${hash}` using thread_id from config and hashed message content
- For streaming calls: cache the final aggregated response after stream completion
- Cache failures are transparent — LLM calls proceed normally on cache miss or failure (fail-open)

## Capabilities

### New Capabilities
- `llm-caching`: Cache-aside LLM response caching with configurable size and TTL, keyed by threadId and hashed message content

### Modified Capabilities
<!-- No existing spec-level requirements are changing; this is a new capability -->

## Impact

- **Dependencies**: Adds `tiny-lru` package
- **New files**: `src/cache/llm_cache.js`
- **Modified files**: `src/agent/react.js` (cache integration), `src/config/schemas.js` (lru config schema), `package.json` (dependency)
- **Configuration**: New `lru.size` and `lru.ttl` config properties with sensible defaults
- **No breaking changes**: Cache is transparent — existing behavior is preserved, caching is additive