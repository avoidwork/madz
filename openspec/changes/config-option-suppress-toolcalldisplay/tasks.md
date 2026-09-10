## 1. Config

- [x] 1.1 Add `showToolResults: true` to the `tui:` section in `config.yaml`

## 2. Core Implementation

- [x] 2.1 Add `showToolResults` prop to `MessageBubbleInner` and conditionally render `toolCallDisplay`
- [x] 2.2 Accept and pass `showToolResults` through `MessageList` render loop
- [x] 2.3 Read `config.tui.showToolResults` in `ConversationArea` and pass to `MessageList`

## 3. Tests

- [x] 3.1 Add test cases in `messageBubble.test.js` verifying `toolCallDisplay` is absent when `showToolResults` is `false`, while `activeToolCall` and `completedToolCalls` remain visible

## 4. Verification

- [x] 4.1 Run `npm run test` to confirm no regressions
- [x] 4.2 Run `npm run coverage` to confirm coverage maintained
