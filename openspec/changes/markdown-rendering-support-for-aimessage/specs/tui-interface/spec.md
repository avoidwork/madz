## ADDED Requirements

### Requirement: Markdown-Formatted Message Display
The system SHALL render assistant and system messages with markdown formatting support, converting markdown syntax to terminal-compatible styled display.

#### Scenario: Assistant message with markdown is rendered with formatting
- **WHEN** the conversation panel displays an assistant message containing markdown (headings, bold, lists, code blocks)
- **THEN** the system renders the message with visual formatting: headings appear as bold lines, lists use bullet characters, bold is rendered in bold, italic in italic, and code blocks are indented with a top and bottom border

#### Scenario: User message is not markdown-processed
- **WHEN** the conversation panel displays a user message
- **THEN** the system displays the message content as plain text without markdown parsing

#### Scenario: System message with markdown is rendered with formatting
- **WHEN** the conversation panel displays a system message containing markdown
- **THEN** the system renders the message with the same markdown visual formatting as assistant messages

#### Scenario: Messages with no markdown render normally
- **WHEN** the conversation panel displays an assistant message without any markdown syntax
- **THEN** the system renders the message identically to the existing plain text behavior

### Requirement: Terminal Scroll Height Accuracy
The system SHALL calculate scroll heights that account for blank lines and indentation introduced by markdown formatting in messages.

#### Scenario: Scroll position remains correct after markdown rendering
- **WHEN** the conversation renders multiple messages with mixed formatted and plain content
- **THEN** the scroll viewport accurately reflects the total rendered height and allows smooth scrolling through all messages
