## 1. Implementation

- [ ] 1.1 Remove the empty-message rendering branch from the `FilePicker` render in `src/tui/filePicker.js` so that when the filter matches no files, nothing is rendered below the input (an empty list).
- [ ] 1.2 Verify the "Loading files..." state and the matched-file list rendering are preserved unchanged.

## 2. Tests

- [ ] 2.1 Add a test case in `tests/unit/tui/filePicker.test.js` that verifies no empty message is rendered when the filter has no matches.

## 3. Verification

- [ ] 3.1 Run `npm run test` and confirm all tests pass.
- [ ] 3.2 Run `npm run lint` and confirm lint passes.
- [ ] 3.3 Run `npm run coverage` and confirm no regressions.
