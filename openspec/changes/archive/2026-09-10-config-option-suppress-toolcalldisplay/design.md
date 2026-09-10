## Context

The TUI message bubble renders three tool-related elements for assistant messages:
1. `activeToolCall` — "Running: {name} ..." indicator (shown during tool execution)
2. `toolCallDisplay` — gray result lines showing tool call output (set at stream finalization)
3. `completedToolCalls` — "⚡ N tool calls: ..." summary (shown after streaming completes)

The `toolCallDisplay` lines are built from `lastToolCallDisplay` in `conversationArea.js` during `finalizeStreaming()` and stored in the message data as `toolCallDisplay`. This data flows through `MessageList` → `MessageBubble` as a prop.

Currently there is no way to suppress the `toolCallDisplay` lines. The config system (`config.yaml`) already has a `tui:` section with `name` and `renderWindow` keys, providing a natural place for a new `showToolResults` option.

## Goals / Non-Goals

**Goals:**
- Add `tui.showToolResults` config option (default `true`) to `config.yaml`
- When `false`, suppress rendering of `toolCallDisplay` in `MessageBubble`
- `activeToolCall` and `completedToolCalls` remain visible regardless of the setting
- Thread the config value through the component hierarchy: `ConversationArea` → `MessageList` → `MessageBubble`
- Add test coverage for the suppression behavior

**Non-Goals:**
- No changes to how `toolCallDisplay` data is collected or stored — only its rendering is conditional
- No changes to `activeToolCall` or `completedToolCalls` rendering logic
- No UI for toggling this at runtime (config file only)

## Decisions

1. **Prop threading over context**: The `showToolResults` value is small, single-purpose, and only affects one leaf component. Threading it as a prop through `MessageList` to `MessageBubble` is simpler and more explicit than adding a new React context. The existing `PubSubContext` and `ScrollContext` are for streaming and scroll mechanics — adding a config context would be over-engineering for a single boolean.

2. **Default `true`**: Preserves existing behavior. Users who want to suppress tool results must explicitly opt in by setting `showToolResults: false`.

3. **Condition in `MessageBubbleInner` render**: The `toolCallDisplay` block (lines 304-314) is wrapped with `showToolResults !== false`. This is the minimal change — a single conditional guard. The `hasToolCallDisplay` boolean on line 261 is also gated so the variable is `false` when suppressed.

4. **Config access at `ConversationArea` level**: `ConversationArea` already receives the full `config` object as a prop. Reading `config?.tui?.showToolResults` there and passing it down is consistent with how `assistantName` is derived from `config?.tui?.name`.

## Risks / Trade-offs

- **Risk: Prop drilling depth** → Mitigation: The chain is only 3 levels (ConversationArea → MessageList → MessageBubble). If more TUI config options are added later, a dedicated config context may become warranted, but for a single boolean this is acceptable.
- **Risk: Stale config value during a session** → Mitigation: Config is loaded at startup and not hot-reloaded. The value is read once and passed as a prop. This is consistent with how all other config values work in the TUI.
