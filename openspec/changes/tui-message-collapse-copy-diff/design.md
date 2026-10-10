## Context

The TUI message stream (`src/tui/messageBubble.js`) renders reasoning segments as gray offset text, tool calls as flat text, code blocks via `MarkdownText` (which already applies `cli-highlight` syntax highlighting), and file changes as plain text. There is no collapse/expand affordance, no code-copy button, and no diff renderer. The `clipboardy` dependency is already imported in `src/tui/app.js` (line 17) and used for selection copy (line 462).

## Goals / Non-Goals

**Goals:**
- Add a collapse/expand toggle for reasoning segments (`💭 Thinking…` when collapsed).
- Add collapsible tool-call blocks showing tool name + args collapsed, expandable to the full result.
- Add a `[copy]` affordance on fenced code blocks, reusing `clipboardy`.
- Add an inline diff view rendering file edits as green/red diff lines in a collapsible block.

**Non-Goals:**
- Replacing the lightweight markdown renderer with a full-featured one.
- Rendering diffs as separate panes.
- Adding new credentials or storage.

## Decisions

- **Collapse state lives in `MessageBubbleInner` via `useState`.** Reasoning and tool-call collapse are per-bubble UI concerns; keeping the toggle state local avoids threading props through `MessageList`/`conversationArea`. A single `collapsed` state object keyed by segment type (`reasoning`, `toolCall`) is sufficient.
- **Copy handler lives in the component layer, not `MarkdownText`.** `MarkdownText` is a pure renderer with no clipboard access. The `[copy]` affordance is rendered by `MessageBubbleInner`, which receives a `onCopy` callback (or uses `clipboardy` directly) so the pure renderer stays side-effect-free.
- **Diff rendering is a new pure helper.** A `renderDiff(text)` function produces green/red ANSI lines from a unified diff string. It is exported from `messageBubble.js` (or a small helper) so it can be unit-tested in isolation. The diff block is collapsible like tool-call blocks.
- **Tool-call data source.** Tool-call blocks source from `events` (raw stream events), `activeToolCall`, `toolCallDisplay`, and `completedToolCalls` already flowing through `conversationArea.js` → `messageList.js` → `MessageBubble`. The `events` array carries `on_tool_start`/`on_tool_end`/`tool` events with name and input.

## Risks / Trade-offs

- **Collapse state reset on re-render.** Because `MessageBubbleInner` is memoized and re-renders on pub/sub updates, collapse state must be preserved across streaming updates. Mitigation: keep collapse state in `useState` (not reset by prop changes) and only initialize once.
- **Clipboard in non-TTY/CI.** `clipboardy` may fail in headless environments. Mitigation: wrap the copy in a try/catch and degrade silently (no crash).
- **Diff parsing edge cases.** Diffs with no changes or malformed hunks must render gracefully. Mitigation: the `renderDiff` helper handles empty input and unknown lines by falling back to plain text.
- **XSS / ANSI injection.** Rendered content is terminal text, not HTML; `MarkdownText` already sanitizes. Diff lines are colored via ANSI codes only, never raw model output injected as markup.
