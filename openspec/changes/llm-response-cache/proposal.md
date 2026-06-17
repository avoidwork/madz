## Why

Repeated identical or near-identical prompts waste tokens, increase latency, and inflate costs. Caching LLM responses for previously seen inputs provides immediate replies, reduces API load, and improves overall system efficiency. A cache-aside pattern ensures transparency — the LLM path remains simple and fail-open.

## What Changes

- Add `tiny-lru` as a dependency for in-memory LRU caching
- Introduce a new `lru` configuration object with `size` (default: 100) and `ttl` (default: 600000ms / 10 minutes)
- Create a dedicated LRU cache module (`src/cache/lru.js`) that wraps tiny-lru
- Implement cache-aside pattern in `src/agent/react.js` for both streaming and non-streaming LLM calls
- Generate cache keys from `threadId` and SHA-256 hash of message content (`threadId_<hash>`)
- Cache the full aggregated response after streaming completes; check cache before stream begins
- All LLM providers benefit transparently — no provider-specific changes needed

## Capabilities

### New Capabilities
- `llm-caching`: LRU-based cache-aside pattern for LLM responses, keyed by thread and prompt hash, with configurable size and TTL

### Modified Capabilities
<!-- No existing spec-level requirements are changing; this is a new capability -->

## Impact

- **New files:** `src/cache/lru.js`, `src/cache/lru.test.js`
- **Modified files:** `src/agent/react.js` (cache-aside wrapper), `src/agent/react.test.js` (cache tests), `package.json` (tiny-lru dependency)
- **Dependencies:** `tiny-lru` (new npm dependency)
- **Config:** New `lru.size` and `lru.ttl` config properties
- **API:** No external API changes — caching is transparent to callers
- **Performance:** Reduces redundant LLM calls for identical prompts within the same thread and TTL window