## MODIFIED Requirements

### Requirement: MessageBubble renders reasoning content
The MessageBubble component SHALL render reasoning segments as muted (gray) offset text without any unicode prefix. When a MessageBubble's reasoningContent is present and role is "assistant", it renders the reasoning content as muted text, truncated to 200 characters, with no `💭 ` prefix prepended.

#### Scenario: MessageBubble renders reasoning content without unicode prefix
- **WHEN** a MessageBubble's reasoningContent is present and role is "assistant"
- **THEN** it renders the reasoning content as muted text, truncated to 200 characters, with no `💭 ` prefix prepended
