# tui-streaming Specification Delta

## MODIFIED Requirements

### Requirement: finalizeStreaming SHALL pass accumulated reasoning
The `finalizeStreaming` function SHALL pass the accumulated reasoning content to the message update.

#### Scenario: Reasoning passed to message
- **WHEN** `finalizeStreaming(responseContent, committedReasoning, ...)` is called
- **THEN** the message is updated with `reasoningContent: committedReasoning || undefined`

#### Scenario: Reasoning-only completion dispatches silent continue
- **WHEN** a turn finalizes with committed reasoning present and no committed message content
- **THEN** the system dispatches a silent "Please continue." prompt via `handleChat(text, { silentUser: true })`

#### Scenario: Reasoning-only continue renders in a fresh bubble
- **WHEN** the silent continue produces a response
- **THEN** the response streams into a new assistant bubble rather than appending to the existing reasoning bubble
