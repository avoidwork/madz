## 1. Setup

- [ ] 1.1 Add `markdown-it` to package.json via `npm install markdown-it`

## 2. ANSI Color Utility Module

- [ ] 2.1 Create `src/tui/ansi.js` with `getColorCode(name)` returning Ink-compatible color prop values
- [ ] 2.2 Create `createStyledBox(children, borderColor, padding)` helper that wraps Ink `Box` elements with consistent styling
- [ ] 2.3 Create `createPlainText(text, color)` helper that returns an Ink `Text` element with the given color
- [ ] 2.4 Write unit tests for `ansi.js` covering all exported helpers

## 3. Markdown-to-Ink Renderer

- [ ] 3.1 Create `src/tui/markdownRenderer.js` with an internal `markdownParser` instance from `markdown-it` configured with a custom renderer
- [ ] 3.2 Implement heading token handling: render `h1`-`h6` as bold `Text` with blank line before and after
- [ ] 3.3 Implement bold token handling: render `**text**` / `__text__` as bold `Text` (pass-through to Ink `bold` prop)
- [ ] 3.4 Implement italic token handling: render `_text_` / `*text*` as italic `Text` (pass-through to Ink `italic` prop)
- [ ] 3.5 Implement inline code token handling: render `` `code` `` as gray `Text`
- [ ] 3.6 Implement fenced code block token handling: render with top border line, indented gray `Text` lines, and bottom border line
- [ ] 3.7 Implement unordered list token handling: render `- item` with `•` bullet character and indentation
- [ ] 3.8 Implement ordered list token handling: render `1. item` with numbered prefix
- [ ] 3.9 Implement horizontal rule token handling: render `---` / `***` as a full-width separator line with blank lines before and after
- [ ] 3.10 Implement `renderMarkdown(text)` function that wraps all rendering in a `try/catch` and falls back to plain text on any error
- [ ] 3.11 Write unit tests for `markdownRenderer.js` covering: headings, bold, italic, inline code, fenced code blocks, unordered lists, ordered lists, horizontal rules, empty input, malformed markdown graceful degradation

## 4. Conversation Panel Integration

- [ ] 4.1 Update `src/tui/conversationPanel.js` to import `renderMarkdown` from `./markdownRenderer`
- [ ] 4.2 Modify the message rendering loop: for assistant and system messages, call `renderMarkdown(msg.content)` instead of passing `msg.content` directly to `Text`
- [ ] 4.3 For user messages, continue using plain text rendering (no change from existing behavior)
- [ ] 4.4 Verify rendered Ink elements are correctly spliced into the `children` array

## 5. Scroll Height Calculation

- [ ] 5.1 Update `src/tui/messages.js` — add line-count estimation that accounts for blank lines from markdown formatting
- [ ] 5.2 Update `countMessageLines` to add extra lines for headings (+1), fenced code blocks (+1 top border, +1 bottom border), and horizontal rules (+2)
- [ ] 5.3 Update `calcVisibleCount` to use the new line estimation logic when messages contain markdown

## 6. Integration Tests

- [ ] 6.1 Write integration test verifying ConversationPanel renders markdown-formatted assistant messages with Ink components
- [ ] 6.2 Write integration test verifying user messages bypass markdown rendering and render as plain text
- [ ] 6.3 Write integration test verifying scroll height calculation matches rendered content after markdown transformation

## 7. Tests and Verification

- [ ] 7.1 Verify `tests/unit/tui/markdownRenderer.test.js` achieves 100% coverage for `markdownRenderer.js`
- [ ] 7.2 Verify `tests/unit/tui/ansi.test.js` achieves 100% coverage for `ansi.js`
- [ ] 7.3 Verify existing `tests/unit/tui.tui.test.js` still passes with updated `countMessageLines` behavior
- [ ] 7.4 Run `npm run test` and confirm all TUI tests pass
- [ ] 7.5 Run `npm run coverage` and confirm total coverage stays at or above 100%
- [ ] 7.6 Run `npm run lint` and confirm no lint errors
