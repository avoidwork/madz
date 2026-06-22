## 1. Add string-width dependency

- [ ] 1.1 Add `string-width` to package.json dependencies

## 2. Refactor inputPanel.js

- [ ] 2.1 Remove the `Blink` component entirely
- [ ] 2.2 Import `useCursor` from `ink` and `string-width`
- [ ] 2.3 Implement `useCursor` hook with `setCursorPosition` in `InputPanel`
- [ ] 2.4 Use `string-width(prompt + inputText)` for x-position calculation
- [ ] 2.5 Hide cursor (`setCursorPosition(undefined)`) when unfocused (cursorColor === "#202020")
- [ ] 2.6 Add `> ` prompt prefix to the rendered text
- [ ] 2.7 Remove `cursorChar` prop from `InputPanel` API

## 3. Update app.js consumer

- [ ] 3.1 Remove `cursorChar` prop from `InputPanel` call site
- [ ] 3.2 Keep `cursorColor` prop passing (undefined when focused, "#202020" when unfocused)

## 4. Write unit tests

- [ ] 4.1 Create `tests/unit/inputPanel.test.js`
- [ ] 4.2 Test: InputPanel renders prompt prefix and input text
- [ ] 4.3 Test: InputPanel does not export Blink component
- [ ] 4.4 Test: InputPanel accepts and ignores cursorChar prop (backward compat)
- [ ] 4.5 Test: useCursor is called with correct x-position for plain ASCII text
- [ ] 4.6 Test: useCursor is called with correct x-position for text with wide characters

## 5. Verify

- [ ] 5.1 Run `npm run lint` — passes
- [ ] 5.2 Run `npm run test` — all tests pass
- [ ] 5.3 Run `npm run coverage` — 100% coverage maintained
