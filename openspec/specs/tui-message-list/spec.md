# tui-message-list Specification

## Purpose
TBD - created by archiving change 2025-08-29-remove-render-window-message-limit. Update Purpose after archive.
## Requirements
### Requirement: Message List Renders All Messages
The TUI MessageList component MUST render conversation messages through a windowed virtual scroll view, mounting only the visible window plus an overscan buffer rather than a configurable hard limit. All historical messages remain accessible via the ScrollView.

#### Scenario: Render only the windowed subset in a long conversation
- **WHEN** a conversation has more than 100 messages
- **THEN** the MessageList mounts only the visible window plus the overscan buffer, not all messages

#### Scenario: No renderWindow prop on MessageList
- **WHEN** the MessageList component is rendered
- **THEN** it does not accept or use a `renderWindow` prop

#### Scenario: ScrollView scrolls through full history
- **WHEN** a user scrolls up in the message list
- **THEN** all historical messages are accessible via the ScrollView

### Requirement: No Config Option for Message Limit
The `tui.renderWindow` configuration option MUST be removed. The `tui.overscan` configuration option controls how many messages are mounted beyond the viewport on each side.

#### Scenario: Config schema has no renderWindow field
- **WHEN** the TuiSchema Zod schema is validated
- **THEN** it does not include a `renderWindow` field

#### Scenario: Config schema has an overscan field
- **WHEN** the TuiSchema Zod schema is validated
- **THEN** it includes an `overscan` field that is a non-negative integer defaulting to 10

#### Scenario: App does not pass renderWindow to ConversationPanel
- **WHEN** the app renders the ConversationPanel
- **THEN** no `renderWindow` prop is passed

### Requirement: Pub/Sub Topics Remain Valid
All message pub/sub topics MUST remain registered for the lifetime of the message.

#### Scenario: Older message topics receive streaming updates
- **WHEN** a message near the top of the conversation receives a streaming update
- **THEN** the update is delivered via the pub/sub topic

#### Scenario: No prunedIds cleanup
- **WHEN** messages are added to the conversation
- **THEN** no pub/sub topics are removed for older messages

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

### Requirement: MessageList preserves streaming and auto-scroll behavior
The MessageList SHALL preserve the pub/sub streaming path and `isUserScrolledUpRef` auto-scroll suppression when using the virtualized scroll view. A growing bubble reports height via `onHeight`; scroll-to-bottom re-anchors when the user is at the bottom.

#### Scenario: Streaming updates delivered via pub/sub
- **WHEN** a message is streaming and its content changes via `updateMessage()`
- **THEN** the update is delivered via the pub/sub topic without a full parent re-render

#### Scenario: Auto-scroll suppressed when user scrolls up
- **WHEN** the user scrolls up away from the bottom and is not streaming
- **THEN** the MessageList does NOT auto-scroll until the user returns to the bottom or streaming resumes

#### Scenario: Growing bubble re-anchors to bottom
- **WHEN** a mounted bubble grows via streaming and the user is at the bottom
- **THEN** the scroll position re-anchors to the bottom

### Requirement: MessageList supports in-conversation search state
The MessageList SHALL maintain a `searchQuery` state and a `searchIndex` (current match) and expose an imperative API (`setSearchQuery`, `clearSearch`, `searchNext`, `searchPrev`) for search control. The search SHALL reuse `getMessages()` to find matches and compute the scroll target offset.

#### Scenario: setSearchQuery updates the search query
- **WHEN** `setSearchQuery(query)` is called with a non-empty query
- **THEN** the search query is updated and matching messages are computed

#### Scenario: clearSearch resets search state
- **WHEN** `clearSearch()` is called
- **THEN** the search query is cleared and highlighting is removed

#### Scenario: searchNext advances the current match
- **WHEN** `searchNext()` is called with search results present
- **THEN** the search index advances to the next match and the scroll view scrolls to it

#### Scenario: searchPrev moves to the previous match
- **WHEN** `searchPrev()` is called with search results present
- **THEN** the search index moves to the previous match and the scroll view scrolls to it

### Requirement: MessageList highlights search matches
The MessageList SHALL compute local match ranges within each bubble's text and pass them to `MessageBubble` for highlighting when a search query is active. The search SHALL be case-insensitive and treat the query as a literal string.

#### Scenario: Search matches are highlighted in bubbles
- **WHEN** a search query is active and a bubble's text contains a match
- **THEN** the matching text is highlighted in the bubble

#### Scenario: Search query with special characters is treated literally
- **WHEN** the search query contains regex special characters
- **THEN** the query is escaped and treated as a literal string

#### Scenario: No matches found is handled gracefully
- **WHEN** a search query has no matches
- **THEN** the conversation renders without crashing and no highlights are shown

