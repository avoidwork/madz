## MODIFIED Requirements

### Requirement: MessageBubble renders reasoning content
The MessageBubble component SHALL render reasoning segments as muted (gray) offset text without any unicode prefix. When a MessageBubble's reasoningContent is present and role is "assistant", it renders the reasoning content as muted text, with no `💭 ` prefix prepended. The reasoning block SHALL be collapsible: when collapsed it renders a single `💭 Thinking…` line, and when expanded it renders the full gray content. The collapse state SHALL be toggled by a click/keyboard handler and SHALL default to expanded.

#### Scenario: MessageBubble renders reasoning content without unicode prefix
- **WHEN** a MessageBubble's reasoningContent is present and role is "assistant"
- **THEN** it renders the reasoning content as muted text, with no `💭 ` prefix prepended

#### Scenario: MessageBubble collapses reasoning to a single thinking line
- **WHEN** a MessageBubble's reasoning segment is present and the collapse toggle is activated
- **THEN** it renders a single `💭 Thinking…` line instead of the full gray content

#### Scenario: MessageBubble expands a collapsed reasoning block
- **WHEN** a collapsed reasoning block's toggle is activated again
- **THEN** it renders the full gray reasoning content

## ADDED Requirements

### Requirement: MessageBubble renders collapsible tool-call blocks
The MessageBubble component SHALL render tool-call blocks as collapsible. When collapsed, it SHALL show the tool name and args on a single line; when expanded, it SHALL render the full tool result. The collapse state SHALL be toggled by a click/keyboard handler and SHALL default to collapsed.

#### Scenario: MessageBubble renders a collapsed tool-call block
- **WHEN** a MessageBubble has an active or completed tool call
- **THEN** it renders the tool name and args collapsed on a single line

#### Scenario: MessageBubble expands a tool-call block to show the full result
- **WHEN** a collapsed tool-call block's toggle is activated
- **THEN** it renders the full tool result

### Requirement: MessageBubble renders a code-block copy affordance
The MessageBubble component SHALL render a `[copy]` affordance on fenced code blocks. When activated, the affordance SHALL copy the code block content to the clipboard via `clipboardy`. The copy handler SHALL be provided by the component layer and SHALL degrade gracefully if clipboard access fails.

#### Scenario: MessageBubble renders a copy affordance on a code block
- **WHEN** a message contains a fenced code block
- **THEN** the bubble renders a `[copy]` affordance alongside the code block

#### Scenario: MessageBubble copies code block content on activation
- **WHEN** the `[copy]` affordance is activated
- **THEN** the code block content is written to the clipboard via `clipboardy`

#### Scenario: MessageBubble degrades gracefully when clipboard fails
- **WHEN** clipboard access fails (e.g., headless environment)
- **THEN** the bubble does not crash and the copy is silently skipped
