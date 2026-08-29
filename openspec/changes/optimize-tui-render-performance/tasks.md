## 1. Memoize ConversationPanel

- [ ] 1.1 Wrap ConversationPanel function in React.memo in src/tui/conversationPanel.js
- [ ] 1.2 Verify no custom comparator needed (default shallow comparison sufficient)

## 2. Memoize App with custom comparator

- [ ] 2.1 Create areEqual comparator function in src/tui/app.js that ignores frequently-changing props
- [ ] 2.2 Wrap App default export with React.memo(App, areEqual)
- [ ] 2.3 Ensure comparator lists all stable props explicitly

## 3. Remove module-level cache from MarkdownText

- [ ] 3.1 Delete lastContentRef and lastElementRef module-level variables in src/tui/markdownText.js
- [ ] 3.2 Delete the cache check and assignment in MarkdownTextInner
- [ ] 3.3 Verify React.memo(MarkdownTextInner) wrapper still exists

## 4. Verify and test

- [ ] 4.1 Run npm run test to confirm no regressions
- [ ] 4.2 Run npm run lint to confirm no lint errors
- [ ] 4.3 Run npm run coverage to confirm coverage maintained
