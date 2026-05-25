## Why

The TUI renders all message content as plain text, including assistant responses that contain markdown (headings, lists, code blocks, bold, italic, etc.). LLM responses heavily use markdown formatting, but the terminal display strips all structure, making long responses hard to scan and read. Users need formatted output to match the quality of the source.

## What Changes

- Add a markdown rendering layer for assistant (and system) messages in the TUI conversation panel.
- Use `ink-markdown` package to render assistant and system messages as Ink-compatible React components.
- Render user messages as plain text (no parsing needed), while assistant and system messages go through the markdown renderer.

## Capabilities

### New Capabilities

- `formatted-messages`: TUI message rendering that differentiates between plain text messages and formatted (markdown) messages, applying appropriate rendering strategies per role using `ink-markdown`.

### Modified Capabilities

- `tui-interface`: The existing tui-interface spec requires an additional requirement: assistant and system messages rendered in the conversation panel SHALL support markdown formatting with headings, lists, bold, italic, and code blocks rendered as terminal-compatible styled text.

## Impact

- `src/tui/conversationPanel.js` — Modify message rendering to use `ink-markdown` for assistant/system message display.
- `src/tui/messages.js` — Update `countMessageLines` to account for possible line expansion from formatted content.
- New dependency: `ink-markdown` (adds `marked` and `marked-terminal` as transitive deps).
- No breaking API changes. Message contract (`Message` type) remains the same; rendering behavior changes internally.
