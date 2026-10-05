## 1. Update formatSize helper

- [x] 1.1 Update `formatSize` in `src/tui/statusBar.js` to apply SI postfix (e.g., `12.2k`, `1.4M`) for context/token numbers, keeping `formatNumber` unchanged for skills/messages.

## 2. Update StatusBar rendering

- [x] 2.1 Replace `[ ]` brackets with `∙` (U+2219) dot separators in `src/tui/statusBar.js` — the model gets no dot; skills, messages, context, tokens, and project each get a `∙` to their left.
- [x] 2.2 Space out unicode glyphs — ensure a space between the glyph and the following number (e.g., `⚡ 12`, `💬 5`, `▦ 12.2k`, `💎 1.4M`).
- [x] 2.3 Ensure dot-space-glyph spacing — a space between the `∙` dot and the glyph that follows it (e.g., `∙ ⚡ 12`, `∙ 💬 5`, `∙ ▦ 12.2k`, `∙ 💎 1.4M`, `∙ project`).
- [x] 2.4 Apply the SI formatter to the token count/budget (`💎`) element.

## 3. Update tests

- [x] 3.1 Update `tests/unit/tui/statusBar.test.js` to assert the new dot-separator layout and SI postfix formatting.
- [x] 3.2 Update `tests/unit/statusBar.test.js` to assert `formatSize` SI postfix behavior.

## 4. Verify

- [x] 4.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions.
