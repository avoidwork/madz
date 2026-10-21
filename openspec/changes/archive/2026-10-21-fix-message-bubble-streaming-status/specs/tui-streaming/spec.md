## MODIFIED Requirements

### Requirement: finalizeStreaming SHALL pass accumulated reasoning
The `finalizeStreaming` function SHALL pass the accumulated reasoning content to the message update. Every path that ends an assistant stream (normal completion, interrupt, error, or a subsequent message segment) SHALL clear the `streaming` flag on the assistant bubble so the spinner stops and the bubble renders as completed.

#### Scenario: Reasoning passed to message
- **WHEN** `finalizeStreaming(responseContent, committedReasoning, ...)` is called
- **THEN** the message is updated with `reasoningContent: committedReasoning || undefined`

#### Scenario: Reasoning-only completion dispatches silent continue
- **WHEN** a turn finalizes with committed reasoning present and no committed message content
- **THEN** the system dispatches a silent "Please continue." prompt via `handleChat(text, { silentUser: true })`

#### Scenario: Reasoning-only continue renders in a fresh bubble
- **WHEN** the silent continue produces a response
- **THEN** the response streams into a new assistant bubble rather than appending to the existing reasoning bubble

#### Scenario: Adding a subsequent message segment clears stale streaming on prior assistant bubble
- **WHEN** a new message segment is added after an assistant message that is still marked streaming
- **THEN** the prior assistant message's `streaming` flag SHALL be cleared to `false`
- **THEN** the spinner SHALL stop and the bubble SHALL render as a completed message

#### Scenario: Interrupt path clears streaming flag
- **WHEN** the user interrupts a streaming assistant response
- **THEN** the assistant message's `streaming` flag SHALL be cleared to `false`

#### Scenario: Error path clears streaming flag
- **WHEN** a streaming assistant response fails with a non-abort error
- **THEN** the assistant message's `streaming` flag SHALL be cleared to `false`
