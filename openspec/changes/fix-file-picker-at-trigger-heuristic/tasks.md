## 1. Tighten the @ trigger heuristic

- [ ] 1.1 Modify `deriveFilter()` in `src/tui/filePicker.js` to require the `@` to be the final token in the input (at the end of the input, cursor at/after the `@`).
- [ ] 1.2 Require the character immediately left of `@` to be a space, or `@` at index 0.
- [ ] 1.3 Require the `@` to be followed by alphanumeric characters.
- [ ] 1.4 Return `active: false` for any `@` that is not a valid trigger token (e.g., mid-string git URL, not preceded by a space, not at the end of input).

## 2. Add regression tests

- [ ] 2.1 Add a test for `@` mid-string (git URL) in `tests/unit/tui/filePicker.test.js`.
- [ ] 2.2 Add a test for `@` not preceded by a space.
- [ ] 2.3 Add a test for `@` not at the end of input.

## 3. Verify

- [ ] 3.1 Run `npm run test` and confirm no regressions.
- [ ] 3.2 Run `npm run coverage` and confirm coverage is maintained.
