## 1. Detector
- [x] 1.1 Add `src/shared/cancelledToolMessage.js` with `isCancelledToolMessage` and `isCancelledToolEvent`.

## 2. TUI filtering
- [x] 2.1 Skip rendering cancelled tool events in `conversationArea.js` while still counting tokens.
- [x] 2.2 Flag cancelled messages in `toConversationExchange` and skip them in `MessageList.setMessages`.

## 3. Tests and verification
- [x] 3.1 Add detector unit tests and `setMessages` cases.
- [x] 3.2 Run test, lint, coverage.
