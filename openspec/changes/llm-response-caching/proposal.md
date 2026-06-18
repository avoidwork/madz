## Why

Repeated identical or near-identical prompts waste tokens, increase latency, and inflate costs. Caching LLM responses for previously seen inputs provides immediate replies, reduces API load, and improves overall system efficiency.

## What Changes

- Add `tiny-lru` as a dependency for in-memory LRU caching
- Introduce `lru` configuration object with `lru.size` (default: 100) and `lru.ttl` (default: 600000ms / 10 minutes)
- Implement cache-aside pattern at the LLM invoke layer: check cache before calling model, store on miss, return cached on hit
- Cache keys follow the format `threadId_<hash>` where hash is computed from message content using `node:crypto`
- For streaming calls: check cache before stream begins, store aggregated result after completion
- Cache operations are fail-open: any cache error falls through to normal LLM call path

## Capabilities

### New Capabilities
- `llm-response-caching`: Cache-aside LLM response caching with configurable size and TTL, keyed by threadId and hashed message content

### Modified Capabilities
<!-- None — this is a new capability, not a modification of existing requirements -->

## Impact

- **Affected code**: `src/agent/react.js` (callReactAgent, callReactAgentStreaming), configuration system, app bootstrap
- **New dependency**: `tiny-lru`
- **Built-in modules**: `node:crypto` for hash computation
- **No breaking changes**: Cache is transparent and fail-open; existing behavior is preserved on cache miss or error