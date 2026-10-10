## Context

The TUI message stream (`src/tui/messageBubble.js`) renders reasoning segments as gray offset text and tool-call output as flat text. Tool messages were folded into the `message` segment (when `showToolResults` was true), polluting the assistant message. There was no collapse/expand affordance, and the collapse state was forked into a `useInput` handler in `messageBubble.js` that was decoupled from the app's input handling.

## Goals / Non-Goals

**Goals:**
- Add a collapse/expand toggle for reasoning segments (`💭 Thinking…` when collapsed), toggled with `ctrl+r`.
- Render tool messages as a distinct `tool` segment type, shown as a collapsible block toggled with `ctrl+t`.
- Lift the collapse state to `App` so the key handler is the single source of truth.
- Make the initial collapse state configurable.
- Ensure `ctrl+r`/`ctrl+t` never reach the input panel (no letter rendered).

**Non-Goals:**
- Replacing the lightweight markdown renderer with a full-featured one.
- Rendering diffs as separate panes.
- Adding new credentials or storage.

## Decisions

- **Collapse state lives in `App`, threaded down as props.** The `useInput` handler in `messageBubble.js` was forked from the app's input handling and caused the collapse toggles to collide with message input. Lifting the state to `App` (where the key handler lives) and threading `reasoningCollapsed`/`toolCallCollapsed` down through `ConversationArea` → `ConversationPanel` → `MessageList` → `MessageBubble` makes `App` the single source of truth. The `ctrl+r`/`ctrl+t` handler in `App` toggles the state and returns early so the key never reaches the input panel.
- **Tool messages are a distinct `tool` segment.** `index.js` emits `ToolMessage` text as a `{ type: "tool", text }` event (never folded into `message`). `conversationArea.js` handles the `tool` event by creating a `tool` segment. `messageBubble.js` renders `tool` segments as a collapsible block wired to `toolCallCollapsed`. When `showToolResults` is `false`, tool text is skipped entirely.
- **Tool segments coalesce with a blank line.** Consecutive tool messages coalesce into a single `tool` segment, joined with `\n\n` so distinct results don't run together.
- **`ink-text-input` is patched via `postinstall`.** `ink-text-input`'s `useInput` handler inserts any key not in its early-return list into the input value, so `ctrl+r`/`ctrl+t` rendered as literal `r`/`t`. A `postinstall` patch (mirroring `patch-langchain-reasoning.mjs`) adds `ctrl+r`/`ctrl+t` to the guard so the keys are swallowed. The patch survives `npm install`.
- **Initial collapse state is configurable.** `tui.reasoningCollapsed` and `tui.toolCallCollapsed` (both default `true`) set the initial state in `App`. Env var equivalents `TUI_REASONING_COLLAPSED`/`TUI_TOOL_CALL_COLLAPSED` map via the config loader's reverse map.

## Risks / Trade-offs

- **Collapse state reset on re-render.** Because `MessageBubbleInner` is memoized and re-renders on pub/sub updates, collapse state must be preserved across streaming updates. Mitigation: the state lives in `App` (not reset by prop changes) and is threaded down.
- **`ink-text-input` patch fragility.** The patch targets a specific string in `ink-text-input`'s build output. If the dependency version changes, the patch may not apply. Mitigation: the patch script checks for the expected source and skips gracefully if it can't find it.
- **Tool segment coalescing.** Tool text arrives in chunks; coalescing must not split distinct tool messages. Mitigation: coalesce with the last `tool` segment, joined with `\n\n`.
- **ANSI injection.** Rendered content is terminal text, not HTML; `MarkdownText` already sanitizes. Tool segments render as plain gray text.
