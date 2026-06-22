## 1. Replace hardcoded time formatting

- [x] 1.1 Replace `formatTime()` in `src/tui/conversationPanel.js` with a cached `Intl.DateTimeFormat` instance using `{ hour: "numeric", minute: "2-digit" }` and `undefined` locale
- [x] 1.2 Add JSDoc `@param` and `@returns` annotations on the updated `formatTime` function

## 2. Update tests

- [x] 2.1 Update the timestamp formatting test in `tests/unit/tui.test.js` to verify the new `Intl.DateTimeFormat` output pattern (accepts localized formats like `2:30 PM` or `14:30`)

## 3. Verify

- [x] 3.1 Run `npm run test` to confirm all tests pass
- [x] 3.2 Run `npm run coverage` to confirm 100% coverage is maintained
