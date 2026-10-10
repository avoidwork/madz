# component-message-bubbles Specification

## Purpose
TBD - created by archiving change replace-ref-based-messages-with-component-message-bubbles. Update Purpose after archive.
## Requirements
### Requirement: MessageBubble manages its own state via chunk accumulation
The MessageBubble component SHALL maintain internal state for chunk accumulation, streaming status, reasoning content, active tool call, and tool call display via `useState`. Each bubble is a standalone React functional component that receives content updates through a pub/sub topic subscription.

#### Scenario: MessageBubble renders initial content
- **WHEN** a MessageBubble is created with role, content, and time
- **THEN** it renders the role label and content area with the initial content as the first chunk

#### Scenario: MessageBubble receives streaming updates via pub/sub
- **WHEN** the corresponding MessageList topic publishes a content chunk (e.g., `publish('msg-1', 'hello')`)
- **THEN** the bubble's chunk accumulator appends the chunk and re-renders with the joined content

#### Scenario: MessageBubble deduplicates identical chunks
- **WHEN** the same chunk is published multiple times (e.g., due to race conditions in streaming handlers)
- **THEN** the bubble ignores the duplicate (last chunk equals new chunk) and does not re-render

#### Scenario: MessageBubble shows streaming indicator
- **WHEN** a MessageBubble's streaming state is true
- **THEN** it appends a cursor character (`\u2588`) to its rendered content

#### Scenario: MessageBubble renders active tool call
- **WHEN** a MessageBubble's activeToolCall is present
- **THEN** it renders a "Running: <name>" indicator below the main content

#### Scenario: MessageBubble renders tool call display output
- **WHEN** a MessageBubble's toolCallDisplay is present
- **THEN** it renders each line of tool call display output below the main content

### Requirement: MessageBubble renders reasoning content
The MessageBubble component SHALL render reasoning segments as muted (gray) offset text without any unicode prefix. When a MessageBubble's reasoningContent is present and role is "assistant", it renders the reasoning content as muted text, with no `💭 ` prefix prepended. The reasoning block SHALL be collapsible: when collapsed it renders a single `💭 Thinking…` line, and when expanded it renders the full gray content. The collapse state SHALL be toggled by `ctrl+r` and SHALL default to collapsed.

#### Scenario: MessageBubble renders reasoning content without unicode prefix
- **WHEN** a MessageBubble's reasoningContent is present and role is "assistant"
- **THEN** it renders the reasoning content as muted text, with no `💭 ` prefix prepended

#### Scenario: MessageBubble collapses reasoning to a single thinking line
- **WHEN** a MessageBubble's reasoning segment is present and the collapse toggle is activated
- **THEN** it renders a single `💭 Thinking…` line instead of the full gray content

#### Scenario: MessageBubble expands a collapsed reasoning block
- **WHEN** a collapsed reasoning block's toggle is activated again
- **THEN** it renders the full gray reasoning content

### Requirement: MessageUpdate via Pub/Sub Topic System
When `updateMessage(id, updates)` is called on MessageList, it SHALL publish the updates to a unique pub/sub topic keyed by message ID. Each MessageBubble subscribes to its own topic (`msg-{id}`) on mount and unsubscribes on unmount. This eliminates the need for the parent to hold refs to individual bubbles.

#### Scenario: Pub/sub topic creation on message add
- **WHEN** `addMessage("user", text)` is called
- **THEN** a unique message ID is generated and a pub/sub topic is registered under `msg-{id}`

#### Scenario: updateMessage triggers bubble re-render via topic publish
- **WHEN** `updateMessage(id, { content: "new" })` is called
- **THEN** the topic `msg-{id}` receives the update, the subscribed bubble appends the content chunk, and re-renders

#### Scenario: updateMessage publishes all update fields
- **WHEN** `updateMessage(id, { streaming: false, reasoningContent: "..." })` is called
- **THEN** the topic publishes the full updates object, and the bubble merges all fields into its state

#### Scenario: Bubble unsubscribes on unmount
- **WHEN** a MessageBubble component unmounts (due to clear or being windowed out)
- **THEN** its topic subscription is removed, preventing memory leaks

### Requirement: MessageList provides imperative message management API
The MessageList component SHALL expose an imperative ref API containing `addMessage(role, content, options)`, `updateMessage(id, updates)`, `clear()`, `setMessages(msgs)`, `getMessageCount()`, and `getScrollRef()` methods, all accessible via a React forwarded ref.

#### Scenario: addMessage creates a new bubble
- **WHEN** `addMessage("user", text)` is called
- **THEN** a new MessageBubble instance is created at the end of the message list

#### Scenario: clear removes all bubbles
- **WHEN** `clear()` is called
- **THEN** all MessageBubble instances are removed and the list shows "No messages yet"

#### Scenario: setMessages initializes from a data array
- **WHEN** `setMessages([{ role: "assistant", content: "Hello" }])` is called
- **THEN** all existing bubbles are cleared and new bubbles are created for each message

#### Scenario: getMessageCount returns current message count
- **WHEN** `getMessageCount()` is called
- **THEN** the current number of stored messages is returned (including windowed-out messages)

#### Scenario: getScrollRef returns the internal ScrollView ref
- **WHEN** `getScrollRef()` is called
- **THEN** the internal ScrollView ref is returned, enabling external scroll control (e.g., keyboard navigation)

### Requirement: MessageList owns scroll management
The MessageList component SHALL manage ScrollView rendering, auto-scroll-to-bottom with throttle, terminal resize handling, and manual scroll detection internally. The ScrollView ref is exposed via `getScrollRef()` for external consumers like App.js keyboard navigation.

#### Scenario: Auto-scroll during streaming
- **WHEN** a message is streaming and its content changes
- **THEN** MessageList scrolls to the bottom of the ScrollView with a 100ms throttle

#### Scenario: Suppress auto-scroll during user manual scroll
- **WHEN** the user scrolls up away from the bottom and is not streaming
- **THEN** MessageList does NOT auto-scroll until the user returns to bottom or streaming resumes

#### Scenario: Immediate scroll on streaming completion
- **WHEN** streaming completes (streaming state set to false)
- **THEN** MessageList immediately scrolls to the bottom (no throttle)

#### Scenario: Remeasure on terminal resize
- **WHEN** the terminal is resized
- **THEN** MessageList's ScrollView ref calls remeasure() to update measured heights

### Requirement: MessageList enforces rendering window
The MessageList component SHALL render at most the last 100 messages (MAX_RENDER_MESSAGES = 100) to prevent performance degradation with very long conversations, while all messages remain available via the imperative API.

#### Scenario: Long conversation limits visible bubbles
- **WHEN** MessageList contains 200 messages and renders
- **THEN** only the last 100 MessageBubble components are rendered in the React tree

#### Scenario: addMessage after window is full still works
- **WHEN** the window is full and `addMessage()` is called
- **THEN** a new message is added and the oldest visible message is dropped

### Requirement: Pub/Sub topic system for bubble communication
The MessageList component SHALL provide a pub/sub system where each message ID maps to a unique topic. Topics are registered on `addMessage`, populated on `updateMessage`, and cleaned up on `clear`. Topics are lightweight arrays of callback listeners.

#### Scenario: Topic creation and publish
- **WHEN** `addMessage("assistant", "")` is called
- **THEN** a topic array is created under key `msg-{id}` in the topics ref

#### Scenario: Multiple subscribers on same topic
- **WHEN** multiple listeners subscribe to the same topic `msg-{id}`
- **THEN** all listeners receive published updates

#### Scenario: Listener cleanup
- **WHEN** a listener unsubscribes from a topic
- **THEN** it is removed from the topic's listener array

#### Scenario: Topic isolation
- **WHEN** `publish('msg-1', chunk)` is called
- **THEN** only subscribers of `msg-1` receive the event, not subscribers of other topics

### Requirement: ConversationPanel delegates to MessageList
The ConversationPanel SHALL be a thin wrapper around MessageList, responsible only for session restore (seed on mount) and forwarding props. The old MessageBubble and renderMessages utilities are exported for backward compatibility but are no longer used by the panel.

#### Scenario: ConversationPanel seeds messages on mount
- **WHEN** ConversationPanel mounts with an initial `messages` array
- **THEN** it calls `panelRef.current.setMessages(messages)` once via a useEffect with empty dependencies

#### Scenario: ConversationPanel shows empty state
- **WHEN** ConversationPanel mounts with no messages or an empty array
- **THEN** MessageList renders "No messages yet. Start chatting!"

### Requirement: No ref callback pattern for bubble updates
The MessageList component SHALL NOT maintain a Map of bubble refs or call imperative methods on child components. All message updates flow through the pub/sub topic system.

#### Scenario: updateMessage does not use bubble refs
- **WHEN** `updateMessage(id, updates)` is called
- **THEN** MessageList publishes to the topic and does NOT look up any bubble ref

### Requirement: No streamingId counter in MessageBubble
The MessageBubble component SHALL NOT use a separate `streamingId` counter to force re-renders. Instead, chunk appending naturally triggers React re-renders via `useState`.

#### Scenario: chunk update triggers re-render via state
- **WHEN** a chunk update is published to a bubble's topic
- **THEN** the bubble's `chunks` state changes, triggering a re-render with the joined content

### Requirement: MessageBubble renders collapsed completed tool calls summary

The MessageBubble component SHALL render a summary of completed tool calls as a collapsed count map, so repeated calls to the same tool display as `name ×count` rather than a repeated list. The summary SHALL hide the `×1` suffix for tools called once and SHALL preserve insertion order (first-call order). The summary SHALL be rendered as `⚡ N tool calls: <name> ×<count>, <name>` where N is the total number of tool calls.

#### Scenario: MessageBubble collapses repeated tool calls

- **WHEN** a MessageBubble's completedToolCalls is a count map `{ read_file: 10, searchCode: 1 }`
- **THEN** it renders `⚡ 11 tool calls: read_file ×10, searchCode`

#### Scenario: MessageBubble hides the count for single calls

- **WHEN** a MessageBubble's completedToolCalls is `{ searchCode: 1 }`
- **THEN** it renders `⚡ 1 tool call: searchCode` without a `×1` suffix

#### Scenario: MessageBubble accepts a legacy array of tool calls

- **WHEN** a MessageBubble's completedToolCalls is a legacy array `["read_file", "read_file", "searchCode"]`
- **THEN** it normalizes the array to a count map and renders `⚡ 3 tool calls: read_file ×2, searchCode`

#### Scenario: MessageBubble renders no summary when there are no completed calls

- **WHEN** a MessageBubble's completedToolCalls is empty or absent
- **THEN** it renders no completed tool calls summary row

### Requirement: MessageList normalizes completed tool calls on session restore

The MessageList component SHALL normalize legacy array-shaped `completedToolCalls` to a count map when restoring messages via `setMessages`, so old session transcripts render correctly with the collapsed summary format.

#### Scenario: setMessages normalizes array-shaped completed tool calls

- **WHEN** `setMessages` is called with a message whose `completedToolCalls` is a legacy array `["read_file", "read_file"]`
- **THEN** the stored message's `completedToolCalls` is normalized to `{ read_file: 2 }`

#### Scenario: setMessages preserves an existing count map

- **WHEN** `setMessages` is called with a message whose `completedToolCalls` is already a count map `{ read_file: 2 }`
- **THEN** the stored message's `completedToolCalls` is unchanged

### Requirement: MessageBubble renders tool messages as a distinct tool segment
The MessageBubble component SHALL render tool messages as a distinct `tool` segment type, shown as a collapsible block. When collapsed, it SHALL render a single `🔧 Tool result` line; when expanded, it SHALL render the full tool result content. The collapse state SHALL be toggled by `ctrl+t` and SHALL default to collapsed.

#### Scenario: MessageBubble renders a collapsed tool segment
- **WHEN** a MessageBubble has a `tool` segment
- **THEN** it renders a single `🔧 Tool result` line

#### Scenario: MessageBubble expands a tool segment to show the full result
- **WHEN** a collapsed tool segment's toggle is activated
- **THEN** it renders the full tool result content

#### Scenario: MessageBubble coalesces consecutive tool segments with a blank line
- **WHEN** multiple tool messages coalesce into a single tool segment
- **THEN** they are joined with a blank line so distinct results don't run together

