## ADDED Requirements

### Requirement: LRU cache module provides a configured cache instance
The system SHALL expose a dedicated LRU cache module (`src/cache/lru.js`) that creates and exports a tiny-lru instance configured with application settings.

#### Scenario: Cache module exports a functional LRU instance
- **WHEN** the cache module is imported
- **THEN** it returns a valid LRU cache instance with configurable `size` and `ttl` properties

#### Scenario: Cache uses default values when config is absent
- **WHEN** `config.lru` is not defined in the application config
- **THEN** the cache uses `size: 100` and `ttl: 600000` (10 minutes) as defaults

#### Scenario: Cache respects configured size and TTL
- **WHEN** `config.lru.size` is set to `N` and `config.lru.ttl` is set to `T`
- **THEN** the LRU instance holds at most `N` entries and each entry expires after `T` milliseconds

### Requirement: Cache keys are generated from thread ID and hashed message content
The system SHALL generate cache keys in the format `${threadId}_${hash}` where `hash` is a SHA-256 hex digest of the message content.

#### Scenario: Cache key is deterministic for identical inputs
- **WHEN** the same `threadId` and message content are provided
- **THEN** the generated cache key is identical

#### Scenario: Cache key differs for different message content
- **WHEN** the same `threadId` but different message content is provided
- **THEN** the generated cache keys are different

#### Scenario: Cache key differs for different thread IDs
- **WHEN** different `threadId` values are provided with the same message content
- **THEN** the generated cache keys are different

### Requirement: Cache-aside pattern is applied to non-streaming LLM calls
The system SHALL check the cache before invoking the LLM in `callReactAgent()`, return cached responses on hit, and store responses on miss.

#### Scenario: Cache hit returns cached response without calling LLM
- **WHEN** a cache key exists for the given thread and message hash
- **THEN** the cached response is returned immediately without calling the LLM provider

#### Scenario: Cache miss calls LLM and stores the response
- **WHEN** a cache key does not exist for the given thread and message hash
- **THEN** the LLM is called, the response is stored in the cache, and the response is returned

#### Scenario: Cached response matches live response shape
- **WHEN** a response is retrieved from cache
- **THEN** the response object has the same structure as a live LLM response (including metadata like token counts and finish reasons)

### Requirement: Cache-aside pattern is applied to streaming LLM calls
The system SHALL check the cache before beginning a stream, skip the stream on hit, and store the aggregated response after stream completion on miss.

#### Scenario: Cache hit skips streaming and returns cached response
- **WHEN** a cache key exists for the given thread and message hash during a streaming call
- **THEN** the cached response is returned immediately without initiating a stream

#### Scenario: Cache miss streams normally and caches the aggregated result
- **WHEN** a cache key does not exist during a streaming call
- **THEN** the stream proceeds normally, and upon successful completion, the full aggregated response is stored in the cache

#### Scenario: Cache stores response only after successful stream completion
- **WHEN** a streaming call fails or is interrupted
- **THEN** no response is stored in the cache

### Requirement: Cache eviction follows LRU policy
The system SHALL evict the least recently used entry when the cache reaches its configured size limit.

#### Scenario: Oldest entry is evicted when cache is full
- **WHEN** a new entry is added and the cache has reached its `size` limit
- **THEN** the least recently used entry is evicted to make room

#### Scenario: Accessed entries are not evicted
- **WHEN** an entry is accessed via `get()` and the cache is full
- **THEN** the accessed entry is promoted and not evicted

### Requirement: Cache entries expire after TTL
The system SHALL automatically expire cache entries after the configured TTL duration.

#### Scenario: Expired entries return undefined on access
- **WHEN** a cache entry has exceeded its TTL
- **THEN** `cache.get(key)` returns `undefined`

#### Scenario: Expired entries are evicted on next access
- **WHEN** a cache entry has exceeded its TTL and is accessed
- **THEN** the entry is removed from the cache and `undefined` is returned

### Requirement: Caching is transparent to all LLM providers
The system SHALL provide caching at the agent invocation layer so that all LLM providers benefit without provider-specific changes.

#### Scenario: Adding a new provider inherits caching automatically
- **WHEN** a new LLM provider is added to the system
- **THEN** cache-aside logic applies to calls through that provider without additional configuration

#### Scenario: Cache keys are provider-agnostic
- **WHEN** cache keys are generated
- **THEN** they are based solely on `threadId` and message content, not on provider identity