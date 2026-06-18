## ADDED Requirements

### Requirement: Cache lookup before LLM call
The system SHALL check the cache for a matching response before making an LLM API call. If a matching cached response exists and has not expired, the system SHALL return the cached response immediately without invoking the LLM.

#### Scenario: Cache hit returns cached response
- **WHEN** a user sends a message that matches a previously cached prompt (same threadId and message content)
- **THEN** the system returns the cached LLM response immediately without calling the LLM API

#### Scenario: Cache miss proceeds to LLM call
- **WHEN** a user sends a message that does not match any cached entry
- **THEN** the system proceeds to call the LLM API normally

### Requirement: Cache storage on miss
The system SHALL store LLM responses in the cache after a successful API call when the response is not already cached. The cached response SHALL include the full text content returned by the LLM.

#### Scenario: Non-streaming response is cached
- **WHEN** `callReactAgent()` completes successfully with a new (uncached) prompt
- **THEN** the response is stored in the cache with the generated cache key

#### Scenario: Streaming response is cached after completion
- **WHEN** `callReactAgentStreaming()` completes successfully with a new (uncached) prompt
- **THEN** the final aggregated response is stored in the cache with the generated cache key

### Requirement: Conditional cache storage based on tool usage
The system SHALL only store LLM responses in the cache when no tools or skills were invoked during the agent execution. If the agent used any tools or skills, the response SHALL NOT be cached, ensuring that state-changing operations are not skipped on subsequent identical prompts.

#### Scenario: Response without tool calls is cached
- **WHEN** `callReactAgent()` completes successfully with a new (uncached) prompt and no tools were invoked
- **THEN** the response is stored in the cache with the generated cache key

#### Scenario: Response with tool calls is not cached
- **WHEN** `callReactAgent()` completes successfully with a new (uncached) prompt and tools were invoked
- **THEN** the response is NOT stored in the cache

#### Scenario: Streaming response without tool calls is cached
- **WHEN** `callReactAgentStreaming()` completes successfully with a new (uncached) prompt and no tools were invoked
- **THEN** the final aggregated response is stored in the cache

#### Scenario: Streaming response with tool calls is not cached
- **WHEN** `callReactAgentStreaming()` completes successfully with a new (uncached) prompt and tools were invoked
- **THEN** the final aggregated response is NOT stored in the cache

### Requirement: Cache key generation
The system SHALL generate cache keys using the format `${threadId}_${hash}` where `threadId` is extracted from `config.configurable.thread_id` and `hash` is a SHA-256 hash of the message content.

#### Scenario: Cache key includes threadId and message hash
- **WHEN** a cache key is generated for a message
- **THEN** the key consists of the threadId, an underscore, and the SHA-256 hash of the message content

#### Scenario: Identical inputs produce identical keys
- **WHEN** the same message is sent in the same thread multiple times
- **THEN** each invocation produces the same cache key

### Requirement: TTL enforcement
The system SHALL expire cached entries after the configured TTL period (default: 600000ms / 10 minutes). Expired entries SHALL not be returned on cache lookup and SHALL be evicted during normal cache operations.

#### Scenario: Expired entry is not returned
- **WHEN** a cached entry has exceeded its TTL
- **THEN** the system treats it as a cache miss and proceeds to call the LLM API

#### Scenario: Default TTL is 10 minutes
- **WHEN** no custom TTL is configured
- **THEN** cached entries expire after 600000 milliseconds (10 minutes)

### Requirement: Size limit and LRU eviction
The system SHALL enforce a maximum cache size (default: 100 entries). When the cache is full, the system SHALL evict the least recently used entry before adding a new one.

#### Scenario: LRU eviction when cache is full
- **WHEN** a new entry is added and the cache has reached its size limit
- **THEN** the least recently used entry is evicted to make room for the new entry

#### Scenario: Default size limit is 100 entries
- **WHEN** no custom size is configured
- **THEN** the cache enforces a maximum of 100 entries

### Requirement: Streaming cache behavior
For streaming LLM calls, the system SHALL check the cache before beginning the stream and SHALL store the final aggregated response after the stream completes successfully. Individual streaming chunks SHALL NOT be cached.

#### Scenario: Cache check before stream begins
- **WHEN** `callReactAgentStreaming()` is invoked
- **THEN** the system checks the cache before starting the stream; if cached, returns immediately without streaming

#### Scenario: Final response cached after stream completion
- **WHEN** a streaming call completes successfully
- **THEN** the aggregated final response is stored in the cache (not individual chunks)

#### Scenario: Failed stream does not cache partial response
- **WHEN** a streaming call fails or is aborted
- **THEN** no partial response is cached

### Requirement: Fail-open cache behavior
The system SHALL never block or fail an LLM call due to cache operations. Cache retrieval failures SHALL result in a normal LLM call. Cache storage failures SHALL not prevent the response from being returned to the client.

#### Scenario: Cache retrieval failure falls back to LLM
- **WHEN** a cache lookup operation fails (e.g., internal error)
- **THEN** the system proceeds to call the LLM API normally

#### Scenario: Cache storage failure does not block response
- **WHEN** a cache store operation fails after a successful LLM call
- **THEN** the response is still returned to the client

### Requirement: Configurable cache parameters
The system SHALL accept configuration for cache size and TTL through the `lru` configuration section. The configuration SHALL be validated against the schema and SHALL use sensible defaults if not provided.

#### Scenario: Default configuration is applied
- **WHEN** no `lru` configuration is provided
- **THEN** the system uses default values: size=100, ttl=600000ms

#### Scenario: Custom configuration is respected
- **WHEN** `lru.size` and `lru.ttl` are configured in the config file
- **THEN** the cache uses the configured values