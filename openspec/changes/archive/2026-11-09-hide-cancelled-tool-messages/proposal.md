## Why

When a new user message arrives mid tool call, deepagents' patch-dangling-tool-calls injects a synthetic ToolMessage ("Tool call <name> with id <id> was cancelled - another message came in before it could be completed.", status "error"). The TUI renders it as a tool call, which is noise. It must stay in provider history (issue 1707).

## What Changes

- Add `src/shared/cancelledToolMessage.js` with `isCancelledToolMessage(msg)` and `isCancelledToolEvent(event)`; the regex lives only there.
- `conversationArea.js` live `tool` handler: still counts tokens into `toolMessageTokensRef`, but does not render a tool segment for cancelled messages.
- `toConversationExchange` in `src/agent/deepAgents.js` flags cancelled tool messages with `cancelled: true` (kept in the conversation list); `MessageList.setMessages` skips flagged rows.
- Unit tests for the detector and `setMessages`.

## Capabilities

### New Capabilities
- `tui-cancelled-tool-messages`: Hiding cancelled tool messages from TUI tool-call rendering.

### Modified Capabilities

## Impact

`src/shared/cancelledToolMessage.js`, `src/tui/conversationArea.js`, `src/tui/messageList.js`, `src/agent/deepAgents.js`, tests.
