## ADDED Requirements

### Requirement: Cache-aside LLM response caching
The system SHALL implement a cache-aside caching pattern at the LLM invoke layer to avoid redundant model calls for previously seen inputs. The cache SHALL check for a cached response before calling the model, store the response on cache miss, and return the cached response on cache hit.

#### Scenario: Cache hit returns immediately
- **WHEN** a request is made with a threadId and message content that matches a previously cached entry
- **THEN** the system returns the cached response immediately without calling the LLM provider

#### Scenario: Cache miss calls the model
- **WHEN** a request is made with a threadId and message content that does not match any cached entry
- **THEN** the system calls the LLM provider, stores the response in the cache, and returns it

#### Scenario: Cache key includes thread isolation
- **WHEN** two requests are made with identical message content but different threadIds
- **THEN** the system treats them as separate cache entries and does not return a cached response from the other thread

### Requirement: Cache key generation
The system SHALL generate cache keys in the format `threadId_<hash>` where the hash is computed from the message content using `node:crypto.createHash('sha256')`. This ensures compact, collision-resistant keys while preserving thread isolation.

#### Scenario: Cache key format
- **WHEN** a request is made with threadId "abc123" and message content "Hello"
- **THEN** the cache key is generated as "abc123_<sha256_hash_of_Hello>"

#### Scenario: Identical inputs produce identical keys
- **WHEN** two requests are made with the same threadId and identical message content
- **THEN** the system generates the same cache key for both requests

### Requirement: Cache configuration
The system SHALL accept configuration for cache size and TTL through a `lru` configuration object with the following properties:
- `lru.size` (default: 100) — maximum number of cached entries
- `lru.ttl` (default: 600000) — time-to-live in milliseconds (10 minutes)

The LRU instance SHALL be created by passing `lru.size` as the first argument and `lru.ttl` as the second argument to the `lru()` factory function: `lru(config.lru.size, config.lru.ttl)`.

#### Scenario: Default cache size
- **WHEN** no `lru.size` is configured
- **THEN** the cache uses a default maximum of 100 entries

#### Scenario: Default TTL
- **WHEN** no `lru.ttl` is configured
- **THEN** the cache uses a default TTL of 600000 milliseconds (10 minutes)

#### Scenario: LRU eviction on size limit
- **WHEN** the cache contains 100 entries and a new entry is added
- **THEN** the least recently used entry is evicted to make room for the new entry

### Requirement: TTL expiration
The system SHALL expire cache entries after the configured TTL has elapsed. Expired entries SHALL be removed from the cache on access or during periodic cleanup.

#### Scenario: Expired entry is not returned
- **WHEN** a cached entry has exceeded its TTL
- **THEN** the system treats it as a cache miss and calls the LLM provider

#### Scenario: TTL is configurable
- **WHEN** `lru.ttl` is set to a custom value (e.g., 300000 for 5 minutes)
- **THEN** the cache uses the configured TTL instead of the default

### Requirement: Streaming cache support
For streaming calls, the system SHALL check the cache before the stream begins. If a cached response exists, it SHALL be returned immediately without starting a stream. If no cached response exists, the stream proceeds normally, and the aggregated result SHALL be stored in the cache after the stream completes successfully. Individual stream chunks SHALL NOT be cached.

#### Scenario: Streaming cache hit
- **WHEN** a streaming request is made with a threadId and message content that matches a cached entry
- **THEN** the system returns the cached response without starting a stream

#### Scenario: Streaming cache miss stores aggregated result
- **WHEN** a streaming request is made with a threadId and message content that does not match any cached entry
- **THEN** the system streams the response from the LLM provider and stores the fully aggregated result in the cache

#### Scenario: Streaming chunks are not cached individually
- **WHEN** a streaming call is in progress
- **THEN** individual chunks are not stored in the cache; only the final aggregated result is cached

### Requirement: Fail-open cache behavior
The system SHALL implement fail-open cache behavior. Any cache operation error (read, write, TTL cleanup) SHALL fall through to the normal LLM call path without interrupting the user experience. The cache is a performance optimization, not a correctness requirement.

#### Scenario: Cache read error falls through
- **WHEN** a cache read operation fails (e.g., memory error)
- **THEN** the system proceeds to call the LLM provider normally

#### Scenario: Cache write error does not break the call
- **WHEN** a cache write operation fails after a successful LLM call
- **THEN** the system returns the LLM response to the user without interrupting the flow

#### Scenario: Cache initialization failure does not block the app
- **WHEN** the LRU cache fails to initialize (e.g., invalid configuration)
- **THEN** the system logs a warning and proceeds without caching, without preventing the app from starting