## ADDED Requirements

### Requirement: Streaming handler SHALL update context size during streaming
The `createStreamingHandler` function SHALL accept a `preStreamContextSize` parameter and an optional `onContextUpdate` callback. When `message` or `on_chat_model_stream` events deliver new content, the handler SHALL calculate the token delta for the accumulated content and update the context size state via the callback.

#### Scenario: Context size updates on message event with content
- **WHEN** a `message` event is received with `event.text`
- **THEN** the content is accumulated and `onContextUpdate` is called with the delta token count added to `preStreamContextSize`

#### Scenario: Context size updates on on_chat_model_stream event with content
- **WHEN** an `on_chat_model_stream` event is received with `event.data.chunk.content`
- **THEN** the content is accumulated and `onContextUpdate` is called with the delta token count added to `preStreamContextSize`

#### Scenario: Context size updates on subsequent chunks
- **WHEN** multiple streaming events are received in sequence
- **THEN** each chunk's content delta is calculated and the context size is updated incrementally

#### Scenario: Context size is not updated when no content is present
- **WHEN** a streaming event is received without content (`event.text` or `event.data.chunk.content` absent)
- **THEN** the context size is not updated

#### Scenario: Context size updates during skill streaming
- **WHEN** `createStreamingHandler` is called with `preStreamContextSize` and `onContextUpdate` during skill execution
- **THEN** context size updates are propagated during streaming

#### Scenario: Context size updates during auto-continue streaming
- **WHEN** `createStreamingHandler` is called with `preStreamContextSize` and `onContextUpdate` during auto-continue
- **THEN** context size updates are propagated during streaming

### Requirement: Post-persistence context recalculation SHALL remain authoritative
After the assistant response is persisted to session state, `updateContextSize` SHALL be called to recalculate the full context size, ensuring the final value accounts for system prompt tokens and any streaming delta discrepancies.

#### Scenario: Full recalculation after persistence
- **WHEN** the assistant response is persisted to session state
- **THEN** `updateContextSize` is called to recalculate the total context size from the full conversation

#### Scenario: Final context size accounts for system prompt
- **WHEN** `updateContextSize` is called after persistence
- **THEN** the system prompt token count is included in the final context size
