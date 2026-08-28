# Spec: TUI Message List

## Requirements

### REQ-1: Message List Renders All Messages

The TUI MessageList component MUST render all conversation messages without a configurable limit.

- The `renderWindow` prop is removed from MessageList, ConversationPanel, and app.js
- The slicing logic `idsRef.current.slice(-renderWindow)` is replaced with `idsRef.current.slice()`
- All message IDs in `idsRef.current` are rendered as MessageBubble components
- The ScrollView mechanism handles scrolling through the full message list

### REQ-2: No Config Option for Message Limit

The `tui.renderWindow` configuration option MUST be removed.

- The `renderWindow` field is removed from the TuiSchema Zod schema in `src/config/schemas/tui.js`
- No default value is provided — the concept of a render window no longer exists

### REQ-3: Pub/Sub Topics Remain Valid

All message pub/sub topics MUST remain registered for the lifetime of the message.

- The `prunedIds` cleanup loop is removed
- Topics for older messages remain in `topicsRef.current` and continue to receive streaming updates

## Constraints

- The data layer already stores all messages without a cap
- The ScrollView component handles scrollable content of arbitrary height
- React.memo on MessageList still prevents unnecessary re-renders
