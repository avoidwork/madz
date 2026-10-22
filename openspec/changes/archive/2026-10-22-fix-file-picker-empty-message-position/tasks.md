## 1. Implementation

- [x] 1.1 Wrap the input `Text` (the `before`/`at`/`after` cursor rendering) in its own `Box` row in `src/tui/filePicker.js` so it occupies a distinct line
- [x] 1.2 Render the " No matching files." empty message as a separate child below the input line in `src/tui/filePicker.js`
- [x] 1.3 Match the `CommandPicker` layout pattern in `src/tui/commandPicker.js` for consistency

## 2. Testing

- [x] 2.1 Add a test case in `tests/unit/tui/filePicker.test.js` verifying the empty message renders below the input line when the filter has no matches
- [x] 2.2 Run `npm run test` and `npm run coverage` to confirm no regressions
