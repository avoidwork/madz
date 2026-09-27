## 1. Implement Trigger Fix

- [ ] 1.1 Rewrite `deriveFilter()` in `src/tui/filePicker.js` to use a regex-based trigger with `\w`, requiring the `@` token to be at a word boundary (start of input or preceded by a space), the cursor to be at the end of the token, and the token to be followed by word characters
- [ ] 1.2 Ensure the edge cases return `active: false`: `@` mid-string (git URL), `@` not preceded by a space, `@` followed by a space, and `@` not at the end of input

## 2. Add Regression Tests

- [ ] 2.1 Add test cases to `tests/unit/tui/filePicker.test.js` for `@` mid-string (git URL), `@` not preceded by a space, `@` not at the end of input, and `@` followed by a space
- [ ] 2.2 Confirm existing active cases still pass (no regression)

## 3. Verification

- [ ] 3.1 Run `npm run test` and confirm all tests pass
- [ ] 3.2 Run `npm run lint` and confirm no lint errors
- [ ] 3.3 Run `npm run coverage` and confirm coverage is maintained
