# Spec Delta

## MODIFIED Requirements

### Requirement: MessageBubble manages its own state via chunk accumulation
The MessageBubble component SHALL maintain internal state for chunk accumulation, streaming status, reasoning content, active tool call, and tool call display via `useState`. Each bubble is a standalone React functional component that receives content updates through a pub/sub topic subscription. The streaming status SHALL be cleared when a new message segment arrives after the assistant message, so the spinner stops and the bubble renders as a completed message.

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

#### Scenario: MessageBubble clears streaming status when a new segment arrives
- **WHEN** a new message segment is added after an assistant message that is still marked streaming
- **THEN** the assistant message's streaming status SHALL be cleared to `false`
- **THEN** the spinner SHALL stop and the bubble SHALL render as a completed message

#### Scenario: MessageBubble does not render a spinner for a bubble with content
- **WHEN** an assistant bubble has non-empty content or segments and a stale `streaming: true` flag
- **THEN** the bubble SHALL NOT render a spinner

#### Scenario: MessageBubble renders active tool call
- **WHEN** a MessageBubble's activeToolCall is present
- **THEN** it renders a "Running: <name>" indicator below the main content

#### Scenario: MessageBubble renders tool call display output
- **WHEN** a MessageBubble's toolCallDisplay is present
- **THEN** it renders each line of tool call display output below the main content

## ADDED Requirements

### Requirement: MessageBubble formats the timestamp at render time
The MessageBubble component SHALL accept a raw timestamp (a `Date` or an ISO8601 string) via the `time` prop and format it to a localized short-form time string at render time using `formatTime()`. The bubble SHALL NOT render the `time` prop verbatim. When the `time` prop is missing or cannot be parsed as a valid date, the bubble SHALL fall back to formatting the current time via `formatTime(new Date())`.

#### Scenario: MessageBubble renders a localized short-form time from a Date
- **WHEN** a MessageBubble is created with a `time` prop that is a valid `Date`
- **THEN** it renders the localized short-form time string produced by `formatTime(date)`

#### Scenario: MessageBubble renders a localized short-form time from an ISO8601 string
- **WHEN** a MessageBubble is created with a `time` prop that is a valid ISO8601 string
- **THEN** it renders the localized short-form time string produced by `formatTime(new Date(isoString))`

#### Scenario: MessageBubble falls back to current time for an invalid timestamp
- **WHEN** a MessageBubble is created with a `time` prop that is missing or cannot be parsed as a valid date
- **THEN** it renders the localized short-form time string produced by `formatTime(new Date())`

#### Scenario: Live and re-loaded sessions render the same timestamp format
- **WHEN** a message is rendered from a live session and the same message is rendered from a re-loaded session
- **THEN** both render the same localized short-form time string, not a raw ISO8601 timestamp
