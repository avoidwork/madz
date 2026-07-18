## 1. Install Dependency

- [ ] 1.1 Install ink-spinner via npm install ink-spinner
- [ ] 1.2 Verify npm install succeeds without peer dependency conflicts

## 2. Implement Spinner in MessageBubble

- [ ] 2.1 Import Spinner from ink-spinner in messageBubble.js
- [ ] 2.2 Add conditional spinner rendering for assistant pending state (chunks.length === 0 && !content)
- [ ] 2.3 Style spinner with cyan color and "Thinking" text label
- [ ] 2.4 Place spinner inside the inner Box alongside MarkdownText

## 3. Verify Implementation

- [ ] 3.1 Run npm test and verify all tests pass
- [ ] 3.2 Run npm lint and verify lint passes
- [ ] 3.3 Run npm start and verify application starts without errors
