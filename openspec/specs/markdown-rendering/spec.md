## ADDED Requirements

### Requirement: Markdown rendering in conversation panel
The system SHALL render markdown-formatted message content in the conversation panel, applying visual formatting for supported syntax elements including bold, italic, inline code, code blocks, headings, lists, and links.

#### Scenario: Bold text renders with emphasis
- **WHEN** a user or assistant message contains `**bold**` or `__bold__` markdown
- **THEN** the terminal displays the text as bold in the conversation panel

#### Scenario: Italic text renders with emphasis
- **WHEN** a message contains `*italic*` or `_italic_` markdown
- **THEN** the terminal displays the text as italic in the conversation panel

#### Scenario: Inline code renders with distinct styling
- **WHEN** a message contains backtick-enclosed inline code `` `code` ``
- **THEN** the terminal displays the inline code with a visual distinction from regular text

#### Scenario: Fenced code blocks render as multiline blocks
- **WHEN** a message contains a fenced code block delimited by `` ``` ``
- **THEN** the terminal displays the block as a visually separated multiline region

#### Scenario: Unordered lists render with bullet markers
- **WHEN** a message contains list items prefixed with `- ` or `* `
- **THEN** the terminal renders each item with a bullet marker

#### Scenario: Headings render with emphasis
- **WHEN** a message contains heading text prefixed with `# `
- **THEN** the terminal displays the heading with a visual distinction from body text

#### Scenario: Plain text messages remain unchanged
- **WHEN** a message contains no markdown formatting characters
- **THEN** the terminal displays the message exactly as plain text with no visual changes

#### Scenario: Unrecognized markdown degrades gracefully
- **WHEN** a message contains markdown syntax the terminal cannot render (e.g., complex HTML)
- **THEN** the system displays the raw markdown characters without errors or crashes

### Requirement: Markdown rendering for both user and assistant messages
The system SHALL render markdown formatting bidirectionally — message content from both `user` and `assistant` roles receives markdown rendering.

#### Scenario: User-sent markdown renders with formatting
- **WHEN** a user types a message containing markdown syntax and sends it
- **THEN** the user's own message displays with proper markdown formatting in the conversation panel

#### Scenario: Assistant markdown response renders with formatting
- **WHEN** the assistant responds with a message containing markdown syntax
- **THEN** the assistant's response displays with proper markdown formatting in the conversation panel
