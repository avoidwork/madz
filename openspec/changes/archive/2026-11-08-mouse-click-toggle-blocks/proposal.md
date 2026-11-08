# Proposal

## Why

Reasoning and tool-call blocks collapse in the TUI (`💭 Thinking… →/↓`, `🔧 <name> →/↓`) but the toggle is keyboard-only (ctrl+r / ctrl+t). A click on a block header is the natural terminal-UI interaction. Closes #1679.

## What Changes

- Add `@ink-tools/ink-mouse` 2.1.0; wrap the TUI root in `MouseProvider` (auto-enable off; enabled in lockstep with the existing `useMouseScroll` focus gating so the two never fight over reporting escape sequences).
- `MessageBubble` registers one `useOnClick` on its outer box and hit-tests the click against its reasoning/tool header boxes, compensating for the virtual scroll offset and clipping to the viewport.
- A hit calls stable `onToggleReasoning` / `onToggleToolCall` callbacks from `App` that flip the existing `reasoningCollapsed` / `toolCallCollapsed` state (same as ctrl+r / ctrl+t). Callbacks are threaded `App → ConversationArea → ConversationPanel → MessageList → MessageBubble`.
- Clicks are ignored while streaming and outside headers. Keyboard toggles remain.

## Capabilities

### Modified Capabilities

- `component-message-bubbles`: collapse toggles gain a validated mouse-click path.

## Impact

- `package.json`, `package-lock.json`, `src/tui/app.js`, `src/tui/conversationArea.js`, `src/tui/conversationPanel.js`, `src/tui/messageList.js`, `src/tui/messageBubble.js`, `src/tui/scrollView.js`, new helper `src/tui/headerClick.js`.
- Tests in `tests/unit/tui/` and `tests/integration/`.

## Non-goals

- No new collapsible component and no new boolean state; no change to collapse rendering or keyboard toggles.
