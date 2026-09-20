## ADDED Requirements

### Requirement: Interrupted Assistant Bubble Persists
The TUI MessageList MUST render an assistant bubble that carries non-empty `reasoning` or `message` segments, even when `streaming` is false and `content` is empty.

#### Scenario: Interrupted assistant bubble with reasoning segments renders
- **WHEN** an assistant message has `streaming` set to false, empty `content`, and a `segments` array containing a `reasoning` segment with non-empty content
- **THEN** the MessageList renders the assistant bubble

#### Scenario: Interrupted assistant bubble with message segments renders
- **WHEN** an assistant message has `streaming` set to false, empty `content`, and a `segments` array containing a `message` segment with non-empty content
- **THEN** the MessageList renders the assistant bubble

#### Scenario: Empty assistant bubble is still skipped
- **WHEN** an assistant message has `streaming` set to false, empty `content`, and no non-empty `reasoning` or `message` segments
- **THEN** the MessageList does not render the assistant bubble

#### Scenario: Streaming assistant bubble always renders
- **WHEN** an assistant message has `streaming` set to true
- **THEN** the MessageList renders the assistant bubble regardless of content or segments
