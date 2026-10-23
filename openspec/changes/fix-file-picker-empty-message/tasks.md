## 1. Implement Empty-Message Removal

- [x] 1.1 Remove the `filteredFiles.length === 0 ? React.createElement(Text, { color: "gray" }, " No matching files.") : ...` branch in the `FilePicker` render (`src/tui/filePicker.js`) so nothing renders when the filter has no matches
- [x] 1.2 Preserve the `!loaded` " Loading files..." branch unchanged

## 2. Add Tests

- [x] 2.1 Add a render test in `tests/unit/tui/filePicker.test.js` asserting the " No matching files." text is never present and the input line always renders
- [x] 2.2 Add a `deriveFilter` precondition test for a typo filter that matches no files (e.g., `@src/confg`)

## 3. Verification

- [x] 3.1 Run `npm run test` and confirm all tests pass
- [x] 3.2 Run `npm run lint` and confirm no lint errors
- [x] 3.3 Run `npm run coverage` and confirm coverage is maintained
