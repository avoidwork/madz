## Why

The TUI renders reasoning and tool-call output as flat, non-interactive text. Long reasoning chains and tool results dominate the message stream, making long agentic sessions hard to scan. These enhancements make the message stream navigable by letting the user collapse reasoning and tool output, and by rendering tool messages as a distinct, collapsible block rather than folding them into the assistant message.

## What Changes

- Add a collapse/expand toggle for reasoning segments, rendering a single `💭 Thinking…` line when collapsed and the full gray content when expanded. Toggled with `ctrl+r`.
- Render tool messages as a distinct `tool` segment type (no longer folded into the `message` segment), shown as a collapsible block. Toggled with `ctrl+t`.
- Lift the collapse state to `App` and thread it down as props, so the key handler in `App` is the single source of truth.
- Make the initial collapse state configurable via `tui.reasoningCollapsed` and `tui.toolCallCollapsed` (both default `true`), with `TUI_REASONING_COLLAPSED` / `TUI_TOOL_CALL_COLLAPSED` env var equivalents.
- Patch `ink-text-input` (via `postinstall`) to swallow `ctrl+r`/`ctrl+t` so the letters never reach the input value.
- Add a "Toggles" section to the banner and `/help` documenting the shortcuts.

## Capabilities

### New Capabilities
- `tui-tool-segment`: Render tool messages as a distinct `tool` segment type in the message bubble, collapsible via `toolCallCollapsed`.

### Modified Capabilities
- `component-message-bubbles`: Add collapse/expand toggles for reasoning segments and tool-call blocks, and render tool messages as a distinct `tool` segment.
- `tui-config`: Add `tui.reasoningCollapsed` and `tui.toolCallCollapsed` configuration options controlling the initial collapse state.

## Impact

- `src/tui/app.js` — owns the collapse state and the `ctrl+r`/`ctrl+t` key handler.
- `src/tui/conversationArea.js` — forwards the collapse props; handles the `tool` event by creating a `tool` segment.
- `src/tui/conversationPanel.js` — forwards the collapse props.
- `src/tui/messageList.js` — forwards the collapse props; coalesces `tool` segments; `shouldRenderBubble`/`estimateMessageHeight` account for `tool` segments.
- `src/tui/messageBubble.js` — renders `reasoning` and `tool` segments as collapsible blocks.
- `src/tui/commandHelp.js` — adds the "Toggles" section to the banner and `/help`.
- `index.js` — emits `ToolMessage` text as a `tool` event, never folded into `message`.
- `scripts/patch-ink-text-input.mjs` — postinstall patch to swallow `ctrl+r`/`ctrl+t`.
- `src/config/schemas/tui.js` + `config.yaml` — new config options.
- `tests/unit/tui/messageBubble.test.js`, `tests/unit/tui/messageList.test.js` — tests for collapse toggles and tool segments.

## Non-goals

- Replacing the lightweight markdown renderer with a full-featured one.
- Rendering diffs as separate panes.
- Adding new credentials or storage.
