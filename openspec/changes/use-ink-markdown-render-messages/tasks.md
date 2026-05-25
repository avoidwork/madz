## 1. Add ink-markdown dependency

- [ ] 1.1 Add `ink-markdown` to package.json dependencies via npm install

## 2. Create markdown renderer module

- [ ] 2.1 Create `src/tui/markdownRenderer.js` with `renderMarkdown` function that converts markdown strings to Ink React elements
- [ ] 2.2 Implement fallback for plain text when no markdown syntax is detected (skip parsing overhead)
- [ ] 2.3 Add `countMarkdownLines` function that estimates visual line count from markdown content for scroll height calculation

## 3. Update ConversationPanel for markdown rendering

- [ ] 3.1 Import `renderMarkdown` and `countMarkdownLines` into `conversationPanel.js`
- [ ] 3.2 Replace plain `Text` rendering of assistant message content with `renderMarkdown` call
- [ ] 3.3 Keep user/system messages rendered as plain text (no markdown processing)
- [ ] 3.4 Wire `countMarkdownLines` into scroll height calculation in the scroll effects

## 4. Update message line counting

- [ ] 4.1 Update `countMessageLines` in `messages.js` to branch between markdown-enabled messages and plain text messages
- [ ] 4.2 Ensure line count estimates remain close enough for smooth scrolling

## 5. Write unit tests

- [ ] 5.1 Add `tests/unit/markdownRenderer.test.js` covering: renderMarkdown with bold, italic, inline code, code blocks, lists, headers, and plain text fallback
- [ ] 5.2 Add `countMarkdownLines` tests for various markdown content patterns
- [ ] 5.3 Update `tests/unit/tui.test.js` if any existing tests need adjustment for markdown integration

## 6. Verify and finalize

- [ ] 6.1 Run `npm run lint` to ensure oxlint and oxfmt pass
- [ ] 6.2 Run `npm run test` to verify all unit tests pass
- [ ] 6.3 Run `npm run coverage` and confirm 100% coverage is maintained
