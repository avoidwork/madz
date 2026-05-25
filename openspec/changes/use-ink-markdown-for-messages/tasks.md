## 1. Install dependency

- [ ] 1.1 Add ink-markdown to package.json dependencies via npm install

## 2. Create MarkdownText component

- [ ] 2.1 Create src/tui/markdownText.js exporting MarkdownText component that wraps ink-markdown's Markdown
- [ ] 2.2 Implement MarkdownText to accept content as children and render via Markdown from ink-markdown
- [ ] 2.3 Ensure MarkdownText handles empty or null content gracefully (renders nothing or placeholder)

## 3. Integrate into message rendering

- [ ] 3.1 Export MarkdownText from src/tui/components.js
- [ ] 3.2 Update src/tui/conversationPanel.js to import and use MarkdownText instead of plain Text for message content
- [ ] 3.3 Ensure MarkdownText is used for both user and assistant message content
- [ ] 3.4 Ensure toolCallDisplay lines remain as plain Text (not rendered as markdown)

## 4. Update message module

- [ ] 4.1 Verify formatMessage in src/tui/messages.js passes raw content through without markdown escaping

## 5. Add tests

- [ ] 5.1 Create tests/unit/tui/markdown-text.test.js with tests for: renders bold, renders code blocks, graceful degradation of unsupported syntax, handles empty content
- [ ] 5.2 Verify existing conversation panel tests still pass

## 6. Verify and commit

- [ ] 6.1 Run npm run lint to verify no lint errors
- [ ] 6.2 Run npm run coverage to verify 100% coverage
- [ ] 6.3 Run npm run test to verify all tests pass
