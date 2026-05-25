## Why

Messages in the TUI conversation panel render as plain text, so markdown content (code blocks with syntax hints, bold, lists, headings, inline code) loses all formatting. The AI assistant's responses are often written in markdown, and users benefit from properly rendered formatting in the terminal.

## What Changes

- Add `ink-markdown` as a dependency
- Create a `MarkdownText` component that wraps `ink-markdown`'s `Markdown` for use inside `Text` and `Box` components
- Update `ConversationPanel` to render message content through `MarkdownText` instead of plain `Text`
- Update `formatMessage` in `messages.js` to preserve raw markdown content (no pre-rendering to plain text)
- Add a unit test for the MarkdownText component

## Capabilities

### New Capabilities
- `markdown-rendering`: Render markdown content in TUI messages with proper formatting (bold, code blocks, lists, headings, inline code) while degrading gracefully to plain text for unsupported syntax

### Modified Capabilities
- (none)

## Impact

- `src/tui/conversationPanel.js` — replace plain Text rendering with MarkdownText
- `src/tui/messages.js` — ensure raw content passes through unchanged
- `package.json` — add `ink-markdown` dependency
- `src/tui/components.js` — export the new MarkdownText component
- New test file: `tests/unit/tui/markdown-text.test.js`
