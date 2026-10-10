## 1. Command Picker Module

- [x] 1.1 Create `src/tui/commandPicker.js` exporting `deriveCommandFilter(value, cursor)` returning `{ filter, tokenStart, tokenEnd, active }`, mirroring `deriveFilter` in `filePicker.js` but triggering on `/`
- [x] 1.2 Add `shouldOpenCommandPicker(value)` to `commandPicker.js` mirroring `shouldOpenPicker`
- [x] 1.3 Add `replaceCommandToken(value, tokenStart, tokenEnd, command)` to `commandPicker.js` mirroring `replaceToken`
- [x] 1.4 Create the `CommandPicker` React component in `commandPicker.js` that filters the command list by prefix and renders suggestions, handling printable chars, backspace, left/right, up/down, Enter (select), and Escape (close)

## 2. InputArea Integration

- [x] 2.1 Add a `commandList` prop to `InputArea` in `src/tui/inputArea.js`
- [x] 2.2 Add `commandPickerOpen` state and a `useEffect` gate mirroring the `pickerOpen` gate, gated by `shouldOpenCommandPicker(inputText)`
- [x] 2.3 Render `CommandPicker` when `commandPickerOpen` is true, and ensure the command picker and file picker are mutually exclusive

## 3. App Threading

- [x] 3.1 In `src/tui/app.js`, pass `commandList={parser.listCommands()}` (plus skill names) to `InputArea`

## 4. Tests

- [x] 4.1 Write `tests/unit/tui/commandPicker.test.js` covering `deriveCommandFilter` and `shouldOpenCommandPicker` (word boundary, bare `/`, mid-string, followed-by-space, cursor-aware filter)
- [x] 4.2 Add tests to `tests/unit/tui/inputArea.test.js` for the command picker gate

## 5. Verification

- [x] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes
