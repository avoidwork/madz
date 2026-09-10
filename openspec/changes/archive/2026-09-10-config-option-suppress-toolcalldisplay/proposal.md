## Why

Users of the madz TUI who run many tool calls per turn experience visual clutter from the gray tool call result lines (`toolCallDisplay`) in assistant message bubbles. While the "Running: ..." indicator and the "⚡ N tool calls: ..." summary provide useful status, the detailed result lines are often noise. Adding a config option to suppress them gives users control over their terminal experience without losing essential feedback.

## What Changes

- Add `tui.showToolResults` boolean config option (default `true`) in `config.yaml`
- When `false`, suppress the `toolCallDisplay` render block in `messageBubble.js` (the gray result lines)
- The `activeToolCall` ("Running: ...") indicator and `completedToolCalls` ("⚡ N tool calls: ...") summary remain visible regardless
- Thread the config value from `ConversationArea` → `MessageList` → `MessageBubble` as a prop

## Capabilities

### New Capabilities
- `tui-config`: TUI display configuration options, starting with `showToolResults`

### Modified Capabilities
- *(none — no existing spec-level behavior changes)*

## Impact

- `config.yaml` — add `showToolResults: true` to `tui:` section
- `src/tui/messageBubble.js` — conditionally render `toolCallDisplay` based on `showToolResults` prop
- `src/tui/messageList.js` — accept and pass through `showToolResults` prop
- `src/tui/conversationArea.js` — read `config.tui.showToolResults` and pass to `MessageList`
- `tests/unit/tui/messageBubble.test.js` — add test cases verifying suppression behavior
