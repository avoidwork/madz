## Why

The TUI renders all message content as plain text, including assistant responses that contain markdown (headings, lists, code blocks, bold, italic, etc.). LLM responses heavily use markdown formatting, but the terminal display strips all structure, making long responses hard to scan and read. Users need formatted output to match the quality of the source.

## What Changes

- Add a markdown rendering layer for assistant (and system) messages in the TUI conversation panel.
- Parse markdown content and convert it to terminal-friendly formatted text with ANSI color codes, proper indentation for lists and code blocks, and structural headings.
- Render user messages as plain text (no parsing needed), while assistant and system messages go through the markdown formatter.
- Introduce a new `src/tui/markdownRenderer.js` module dedicated to the markdown-to-terminal transformation pipeline.
- Create a `src/tui/ansi.js` utility module for ANSI escape code generation and color utilities.

## Capabilities

### New Capabilities

- `markdown-renderer`: Terminal-aware markdown-to-ANSI rendering pipeline that parses markdown syntax and produces formatted plain text with style information.
- `formatted-messages`: TUI message rendering that differentiates between plain text messages and formatted (markdown) messages, applying appropriate rendering strategies per role.

### Modified Capabilities

- `tui-interface`: The existing tui-interface spec requires an additional requirement: assistant and system messages rendered in the conversation panel SHALL support markdown formatting with headings, lists, bold, italic, and code blocks rendered as terminal-compatible styled text.

## Impact

- `src/tui/conversationPanel.js` — Modify message rendering to route assistant/system messages through the markdown renderer before display.
- `src/tui/messages.js` — Update message formatting logic to distinguish formatted vs plain content.
- `src/tui/messages.js` — Update `countMessageLines` to account for possible line expansion from formatted content.
- New files: `src/tui/markdownRenderer.js`, `src/tui/ansi.js`.
- New test files: `tests/unit/tui/markdownRenderer.test.js`, `tests/unit/tui/ansi.test.js`.
- No breaking API changes. Message contract (`Message` type) remains the same; rendering behavior changes internally.
