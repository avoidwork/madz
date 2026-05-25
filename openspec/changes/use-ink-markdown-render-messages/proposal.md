## Why

LLM responses often contain markdown formatting (bold, italic, code blocks, lists) that is currently rendered as raw text in the TUI. Users cannot properly read formatted content. Adding markdown rendering will make conversation content significantly more readable and professional-looking.

## What Changes

- Add `ink-markdown` as a project dependency
- Create a `markdownRenderer.js` module that converts markdown strings to React elements compatible with Ink
- Update `ConversationPanel` to use the markdown renderer for assistant message content
- Wire markdown rendering into scroll height calculation (`countMessageLines`)

## Capabilities

### New Capabilities
- `markdown-rendering`: Render markdown-formatted message content (bold, italic, code, lists, headers) in the TUI conversation panel using `ink-markdown`

### Modified Capabilities
- `tui-interface`: Startup Banner Display scenario extended — banner ASCII art will also benefit from proper markdown handling during initial render

## Impact

- **Dependencies**: Add `ink-markdown` to `package.json`
- **Code**: New module `src/tui/markdownRenderer.js`; modified `src/tui/conversationPanel.js` and `src/tui/messages.js`
- **TUI**: Conversation panel renders assistant messages with markdown formatting instead of raw text
- **Breaking**: None — plain text content continues to render as before, markdown is opt-in by content format
