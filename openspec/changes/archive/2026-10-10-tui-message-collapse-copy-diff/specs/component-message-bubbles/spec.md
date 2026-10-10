## MODIFIED Requirements

### Requirement: MessageBubble renders reasoning content
The MessageBubble component SHALL render reasoning segments as muted (gray) offset text without any unicode prefix. When a MessageBubble's reasoningContent is present and role is "assistant", it renders the reasoning content as muted text, with no `💭 ` prefix prepended. The reasoning block SHALL be collapsible: when collapsed it renders a single `💭 Thinking…` line, and when expanded it renders the full gray content. The collapse state SHALL be toggled by `ctrl+r` and SHALL default to collapsed.

#### Scenario: MessageBubble renders reasoning content without unicode prefix
- **WHEN** a MessageBubble's reasoningContent is present and role is "assistant"
- **THEN** it renders the reasoning content as muted text, with no `💭 ` prefix prepended

#### Scenario: MessageBubble collapses reasoning to a single thinking line
- **WHEN** a MessageBubble's reasoning segment is present and `ctrl+r` is pressed
- **THEN** it renders a single `💭 Thinking…` line instead of the full gray content

#### Scenario: MessageBubble expands a collapsed reasoning block
- **WHEN** a collapsed reasoning block's toggle is activated again
- **THEN** it renders the full gray reasoning content

## ADDED Requirements

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
