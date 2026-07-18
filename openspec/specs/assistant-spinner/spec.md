# assistant-spinner Specification

## Purpose
TBD - created by archiving change add-ink-spinner-assistant-bubble. Update Purpose after archive.
## Requirements
### Requirement: Spinner displays during pending assistant response
The MessageBubble component SHALL render an animated spinner with a "Thinking" label inside the assistant response bubble when the bubble is in a pending state (no streamed chunks and no initial content). The spinner uses the `ink-spinner` package with type `dots2` and is styled in cyan to match the existing TUI theme.

#### Scenario: Spinner shows for empty assistant bubble
- **WHEN** a MessageBubble is created with role="assistant", empty content, and no chunks
- **THEN** an animated spinner with "Thinking" text is rendered inside the bubble

#### Scenario: Spinner hides on first streamed chunk
- **WHEN** a content chunk is published to the bubble's topic
- **THEN** the spinner is removed and the streamed content is rendered via MarkdownText

#### Scenario: Spinner hides on abort
- **WHEN** the assistant response is aborted (streaming stops without content)
- **THEN** the spinner is removed from the bubble

#### Scenario: Spinner hides on interruption
- **WHEN** an interruption is triggered during streaming
- **THEN** the spinner is removed from the bubble

#### Scenario: Spinner does not show for user messages
- **WHEN** a MessageBubble is created with role="user"
- **THEN** no spinner is rendered regardless of content state

#### Scenario: Spinner does not show for system messages
- **WHEN** a MessageBubble is created with role="system"
- **THEN** no spinner is rendered regardless of content state

### Requirement: Spinner does not interfere with message layout
The spinner SHALL be rendered inside the same Box container as the MarkdownText component without causing layout reflow when content appears. Ink's rendering model ensures only changed nodes are re-rendered.

#### Scenario: No layout shift when content appears
- **WHEN** the first streamed chunk arrives and the spinner is replaced by MarkdownText content
- **THEN** the bubble maintains its width and position without reflow

#### Scenario: Spinner coexists with reasoning content
- **WHEN** an assistant bubble has reasoningContent and is in pending state
- **THEN** the spinner renders in the content area while the reasoning content renders below it

