# tui-streaming Specification

## Purpose
TBD - created by archiving change wire-up-streamevents-message-model. Update Purpose after archive.
## Requirements
### Requirement: Message model SHALL include an events array
The Message typedef SHALL include an optional `events` field that stores raw stream events for this message.

#### Scenario: Events field exists on message model
- **WHEN** the Message typedef is defined in `src/tui/messages.js`
- **THEN** it includes `@property {Array<Object>} [events]` as an optional field

### Requirement: MessageList SHALL pass through events in addMessage
The `addMessage` function SHALL accept `events` in the options parameter and store it in the message data.

#### Scenario: addMessage accepts events
- **WHEN** `addMessage(role, content, { events: [...] })` is called
- **THEN** the message data stored in dataRef includes the events array

#### Scenario: addMessage handles missing events
- **WHEN** `addMessage(role, content, {})` is called without events
- **THEN** the message data stores an empty events array or undefined

### Requirement: MessageList SHALL pass through events in setMessages
The `setMessages` function SHALL pass `events` from source messages when initializing the list.

#### Scenario: setMessages preserves events
- **WHEN** `setMessages([{ role: "assistant", content: "...", events: [...] }])` is called
- **THEN** each message's events are stored in dataRef

### Requirement: Streaming handler SHALL capture all event types
The `createStreamingHandler` function SHALL capture all event types from LangChain's `streamEvents` and append them to the message's events array.

#### Scenario: Chat model stream events captured
- **WHEN** an `on_chat_model_stream` event is received
- **THEN** the event is appended to the message's events array

#### Scenario: Tool start events captured
- **WHEN** an `on_tool_start` event is received
- **THEN** the event is appended to the message's events array

#### Scenario: Tool end events captured
- **WHEN** an `on_tool_end` event is received
- **THEN** the event is appended to the message's events array

#### Scenario: Tool error events captured
- **WHEN** an `on_tool_error` event is received
- **THEN** the event is appended to the message's events array

#### Scenario: Agent events captured
- **WHEN** an `on_agent_action` or `on_agent_finish` event is received
- **THEN** the event is appended to the message's events array

#### Scenario: Chain events captured
- **WHEN** an `on_chain_start` or `on_chain_end` event is received
- **THEN** the event is appended to the message's events array

### Requirement: Streaming handler SHALL populate activeToolCall from tool events
The `createStreamingHandler` function SHALL set `activeToolCall` on the message when a tool starts and clear it when a tool ends or errors.

#### Scenario: activeToolCall set on tool start
- **WHEN** an `on_tool_start` event is received with `event.name` and `event.data.input`
- **THEN** `updateMessage` is called with `activeToolCall: { name: event.name, input: event.data.input, status: "running" }`

#### Scenario: activeToolCall cleared on tool end
- **WHEN** an `on_tool_end` event is received
- **THEN** `updateMessage` is called with `activeToolCall: null`

#### Scenario: activeToolCall set with error on tool error
- **WHEN** an `on_tool_error` event is received with `event.name` and `event.data.error`
- **THEN** `updateMessage` is called with `activeToolCall: { name: event.name, error: event.data.error, status: "error" }`

### Requirement: Streaming handler SHALL populate toolCallDisplay from tool end events
The `createStreamingHandler` function SHALL set `toolCallDisplay` on the message when a tool ends successfully.

#### Scenario: toolCallDisplay set on tool end
- **WHEN** an `on_tool_end` event is received with `event.data.output`
- **THEN** `updateMessage` is called with `toolCallDisplay: event.data.output`

### Requirement: Streaming handler SHALL accumulate reasoning from chat model stream events
The `createStreamingHandler` function SHALL extract and accumulate reasoning content from `on_chat_model_stream` events.

#### Scenario: Reasoning extracted from chunk
- **WHEN** an `on_chat_model_stream` event is received with `event.data.chunk.reasoning`
- **THEN** the reasoning content is accumulated into a `committedReasoning` variable

#### Scenario: Reasoning passed to finalizeStreaming
- **WHEN** `finalizeStreaming` is called after streaming completes
- **THEN** the accumulated `committedReasoning` is passed as the second parameter

### Requirement: Streaming handler SHALL accumulate content from chat model stream events
The `createStreamingHandler` function SHALL extract and accumulate text content from `on_chat_model_stream` events when the `message` event type is not present.

#### Scenario: Content extracted from chunk
- **WHEN** an `on_chat_model_stream` event is received with `event.data.chunk.content`
- **THEN** the content is accumulated into `committedContentRef`

### Requirement: finalizeStreaming SHALL pass accumulated reasoning
The `finalizeStreaming` function SHALL pass the accumulated reasoning content to the message update.

#### Scenario: Reasoning passed to message
- **WHEN** `finalizeStreaming(responseContent, committedReasoning, ...)` is called
- **THEN** the message is updated with `reasoningContent: committedReasoning || undefined`

