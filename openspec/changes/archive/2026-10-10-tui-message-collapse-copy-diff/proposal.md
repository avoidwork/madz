## Why

The TUI currently renders reasoning, tool calls, code blocks, and file changes as flat, non-interactive text. Long reasoning chains and tool outputs are hard to scan, and users cannot copy code or review file diffs inline. These enhancements make the message stream more navigable and actionable.

## What Changes

- Add a collapse/expand toggle to reasoning segments, rendering a single `💭 Thinking…` line when collapsed and the full gray content when expanded.
- Add collapsible tool-call blocks that show tool name + args collapsed and expand to the full result.
- Add a `[copy]` affordance on fenced code blocks, reusing `clipboardy` from `src/tui/app.js`. Syntax highlighting already exists via `cli-highlight`.
- Add an inline diff view that renders file edits as green/red diff lines in a collapsible block.

## Capabilities

### New Capabilities
- `tui-inline-diff`: Render file edits as green/red diff lines in a collapsible block within the TUI message stream.

### Modified Capabilities
- `component-message-bubbles`: Add collapse/expand toggles for reasoning segments and tool-call blocks, and a code-block copy affordance in the message bubble component.
- `markdown-rendering`: Add a `[copy]` affordance on fenced code blocks rendered by the markdown renderer.

## Impact

- `src/tui/messageBubble.js` — primary integration point for reasoning/tool-call collapse and copy affordance.
- `src/tui/markdownText.js` — highlighting exists; add `[copy]` affordance.
- `src/tui/app.js` — `clipboardy` imported line 17, used line 462; reused for code copy.
- `src/tui/conversationArea.js` — reasoning segments created lines 668-716; tool-call data flows via `events`.
- `src/tui/messageList.js` — forwards tool-call props ~line 592.
- `src/tools/process/index.js` + `src/tools/code/index.js` — for diff view pairing.
- `tests/unit/tui/messageBubble.test.js` — new tests for collapse/expand, copy handler, and diff rendering.

## Non-goals

- Replacing the lightweight markdown renderer with a full-featured one with built-in syntax highlighting.
- Rendering diffs as separate panes.
- Adding new credentials or storage; `clipboardy` operates on the local clipboard only.
