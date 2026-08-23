## ADDED Requirements

### Requirement: MessageList enforces data-layer message cap on addMessage
The MessageList imperative API SHALL enforce a maximum message count at the data layer when adding a new message via `addMessage()`. When the internal message array exceeds `MAX_RENDER_MESSAGES` (100), the oldest message ID SHALL be removed from the beginning of the array, and all associated data structures SHALL be cleaned up.

#### Scenario: Add message when under cap
- **WHEN** the current message count is less than `MAX_RENDER_MESSAGES` (100)
- **THEN** the new message is appended to the end of the array and `getMessageCount()` returns the incremented count

#### Scenario: Add message when at cap
- **WHEN** the current message count equals `MAX_RENDER_MESSAGES` (100)
- **THEN** the oldest message ID is shifted off the beginning, the new message is appended, and `getMessageCount()` returns `MAX_RENDER_MESSAGES` (100)

#### Scenario: Add message when over cap
- **WHEN** the current message count exceeds `MAX_RENDER_MESSAGES` (100) — e.g., after a session restore with >100 messages
- **THEN** the oldest message ID is shifted off, the new message is appended, and `getMessageCount()` returns `MAX_RENDER_MESSAGES` (100)

#### Scenario: Oldest message data is cleaned up on shift
- **WHEN** a message ID is shifted off the beginning of the array
- **THEN** the entry is removed from `dataRef`, `contentRef`, `idToIdxRef`, and its pub/sub topic from `topicsRef`

### Requirement: MessageList enforces data-layer message cap on setMessages
The MessageList imperative API SHALL enforce a maximum message count at the data layer when initializing from a messages array via `setMessages()`. If the input array exceeds `MAX_RENDER_MESSAGES`, only the last `MAX_RENDER_MESSAGES` entries SHALL be retained.

#### Scenario: Set messages when under cap
- **WHEN** the input message array has fewer than `MAX_RENDER_MESSAGES` (100) entries
- **THEN** all messages are retained and `getMessageCount()` returns the input array length

#### Scenario: Set messages when over cap
- **WHEN** the input message array exceeds `MAX_RENDER_MESSAGES` (100) entries
- **THEN** only the last 100 messages are retained, `getMessageCount()` returns 100, and the oldest messages are excluded from all data structures

#### Scenario: Set messages preserves message order
- **WHEN** the input message array is truncated to the last 100 entries
- **THEN** the relative order of the retained messages is preserved (first retained message is at index 0, last at index 99)

### Requirement: updateMessage() is a no-op for shifted messages
The MessageList imperative API SHALL silently ignore `updateMessage()` calls for message IDs that have been shifted off the data layer. The function SHALL check `idToIdxRef` for the ID and return early if not found.

#### Scenario: Update shifted message is no-op
- **WHEN** a message has been shifted off the data layer (e.g., during streaming)
- **THEN** calling `updateMessage()` with that ID does nothing — no error, no crash, no state change

#### Scenario: Update retained message works normally
- **WHEN** a message is still within the data layer (not shifted off)
- **THEN** `updateMessage()` updates the message data and triggers a pub/sub notification as before

### Requirement: Render layer cap remains as defensive measure
The render layer SHALL continue to use `idsRef.current.slice(-MAX_RENDER_MESSAGES)` to determine which messages to render, providing a defensive layer independent of the data-layer cap.

#### Scenario: Render slice matches data layer
- **WHEN** the data layer has enforced the cap (count ≤ 100)
- **THEN** `idsRef.current.slice(-MAX_RENDER_MESSAGES)` returns all messages (no-op truncation)

#### Scenario: Render slice protects against data layer bypass
- **WHEN** the data layer somehow exceeds the cap (e.g., external mutation)
- **THEN** the render layer still only renders the last 100 messages