## 1. Setup

- [ ] 1.1 Add `string-width` to package.json dependencies
- [ ] 1.2 Remove `cursorChar` and `blinkTimeout` from config schema and defaults

## 2. Refactor InputPanel

- [ ] 2.1 Remove `Blink` component from `inputPanel.js`
- [ ] 2.2 Import `useCursor` from Ink in `inputPanel.js`
- [ ] 2.3 Implement `useCursor` hook call with computed x/y position
- [ ] 2.4 Use `string-width` to calculate cursor x position from prompt + inputText
- [ ] 2.5 Hide cursor (pass `undefined`) when inputText is empty
- [ ] 2.6 Remove `cursorChar` and `cursorColor` props from `InputPanel` API
- [ ] 2.7 Keep `> ` prompt prefix rendering in `InputPanel`

## 3. Update App Component

- [ ] 3.1 Remove `cursorChar` prop from `InputPanel` usage in `app.js`
- [ ] 3.2 Remove `cursorColor` prop from `InputPanel` usage in `app.js`
- [ ] 3.3 Pass `totalRows` prop to `InputPanel` for cursor y-position calculation

## 4. Tests

- [ ] 4.1 Update existing cursor tests to reflect new implementation
- [ ] 4.2 Add test for cursor positioning with wide characters (emoji, CJK)
- [ ] 4.3 Add test for cursor hiding when input is empty
- [ ] 4.4 Add test for cursor showing when input has text
- [ ] 4.5 Verify `Blink` component is no longer exported from `inputPanel.js`

## 5. Verification

- [ ] 5.1 Run full test suite and ensure all tests pass
- [ ] 5.2 Run lint check
- [ ] 5.3 Manual TUI test: verify cursor blinks, positions correctly, hides on empty input
- [ ] 5.4 Manual TUI test: verify IME input works correctly
- [ ] 5.5 Manual TUI test: verify wide characters (emoji, CJK) don't misalign cursor
