## 1. Setup

- [x] 1.1 Add `ink-markdown` to package.json via `npm install ink-markdown`

## 2. Conversation Panel Integration

- [x] 2.1 Update `src/tui/conversationPanel.js` to import `Markdown` from `ink-markdown`
- [x] 2.2 Modify the message rendering loop: for assistant and system messages, render content through the `Markdown` component instead of passing content directly to `Text`
- [x] 2.3 For user messages, continue using plain text rendering (no change from existing behavior)
- [x] 2.4 Add error handling: if markdown rendering fails, fall back to plain text display

## 3. Scroll Height Calculation

- [x] 3.1 Update `src/tui/messages.js` — add line-count estimation that accounts for blank lines from markdown formatting
- [x] 3.2 Update `countMessageLines` to add extra lines for headings, fenced code blocks, and horizontal rules
- [x] 3.3 Verify virtualized scrolling stays in sync with formatted messages

## 4. Integration Tests

- [x] 4.1 Write integration test verifying ConversationPanel renders markdown-formatted assistant messages with Ink components
- [x] 4.2 Write integration test verifying user messages bypass markdown rendering and render as plain text
- [x] 4.3 Write integration test verifying scroll height calculation matches rendered content after markdown transformation

## 5. Tests and Verification

- [x] 5.1 Verify existing `tui.test.js` still passes with updated scroll height calculation
- [x] 5.2 Run `npm run test` and confirm all TUI tests pass
- [x] 5.3 Run `npm run coverage` and confirm total coverage stays at or above 100%
- [x] 5.4 Run `npm run lint` and confirm no lint errors
