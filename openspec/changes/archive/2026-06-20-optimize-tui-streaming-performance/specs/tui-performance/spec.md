## ADDED Requirements

### Requirement: Bounded LRU Parse Cache
The system SHALL replace the unbounded `parseCache` Map in `markdownText.js` with a bounded LRU (Least Recently Used) cache with a maximum of 500 entries.

#### Scenario: Cache entry added
- **WHEN** a unique markdown string is parsed
- **THEN** the parsed result is stored in the cache with the string as key

#### Scenario: Cache eviction on overflow
- **WHEN** a new entry is added and the cache already contains 500 entries
- **THEN** the least recently used entry is evicted and the new entry is added

#### Scenario: Cache hit returns cached result
- **WHEN** a markdown string that exists in the cache is parsed
- **THEN** the cached result is returned without re-parsing

#### Scenario: Cache access updates LRU order
- **WHEN** a cached entry is accessed (read)
- **THEN** that entry is marked as most recently used

### Requirement: Immutable Message Update Pattern
The system SHALL replace the full array spread clone in `setMessages` with an immutable append pattern that avoids cloning the entire messages array.

#### Scenario: New messages appended efficiently
- **WHEN** new message chunks arrive during streaming
- **THEN** the messages array is updated by appending only the new chunks without cloning existing entries

#### Scenario: Message ordering preserved
- **WHEN** multiple streaming events deliver message chunks
- **THEN** messages appear in the correct chronological order

#### Scenario: React state update semantics maintained
- **WHEN** the messages state is updated
- **THEN** React correctly identifies the state change and triggers re-render

### Requirement: Debounced Scroll-to-Bottom
The system SHALL throttle scroll-to-bottom operations during active streaming to 100ms intervals while maintaining immediate scroll on streaming pause.

#### Scenario: Throttled scroll during streaming
- **WHEN** streaming is active and multiple message chunks arrive
- **THEN** scroll-to-bottom is called at most once per 100ms interval

#### Scenario: Immediate scroll on streaming pause
- **WHEN** streaming completes or is aborted
- **THEN** scroll-to-bottom is called immediately

#### Scenario: Manual scroll suppression
- **WHEN** the user manually scrolls up (away from bottom)
- **THEN** auto-scroll-to-bottom is suppressed until the user scrolls back to bottom or streaming completes

### Requirement: Virtual Scrolling for Messages
The system SHALL render only messages visible in the viewport plus a small buffer (2 messages above and below) instead of rendering all messages.

#### Scenario: Only visible messages rendered
- **WHEN** the conversation contains more messages than fit in the viewport
- **THEN** React elements are created only for messages in the viewport plus a 2-message buffer above and below

#### Scenario: Scroll position maintained during streaming
- **WHEN** new messages are added during streaming
- **THEN** the scroll position is maintained or smoothly adjusted without jarring jumps

#### Scenario: Buffer messages rendered for continuity
- **WHEN** the user is viewing messages near the bottom of the viewport
- **THEN** 2 additional messages below the viewport are rendered to ensure smooth scrolling

#### Scenario: Constant React tree size
- **WHEN** the conversation grows from 10 to 1000 messages
- **THEN** the number of React elements in the tree remains approximately constant