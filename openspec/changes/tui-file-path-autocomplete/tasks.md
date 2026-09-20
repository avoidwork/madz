## 1. Dependency

- [ ] 1.1 Run `npm install fast-glob` to promote it to a direct dependency in `package.json`

## 2. FilePicker Component

- [ ] 2.1 Create `src/tui/filePicker.js` exporting a `FilePicker` component that takes the current input value, a callback to update it, and a callback to close
- [ ] 2.2 Implement the cursor-aware filter derivation (text between last `@` and cursor, bounded by whitespace or quotes, trimmed)
- [ ] 2.3 Implement the fixed-pattern glob (`**/*`, ignoring `node_modules`/`.git`/`dist`, `onlyFiles: true`, depth cap) with JS-only substring filtering
- [ ] 2.4 Implement debounced glob (~250ms) with cached initial glob result
- [ ] 2.5 Implement the single `useInput` handler (printable insert at cursor, backspace, left/right, up/down, enter, escape)
- [ ] 2.6 Implement the rotating-window list rendering (up to 3 visible, alphabetical sort, `▸` indicator)
- [ ] 2.7 Implement selection (replace `@` token with full path, wrap in quotes if whitespace)

## 3. Wire into InputArea

- [ ] 3.1 Render `FilePicker` below the `InputPanel` when open in `src/tui/inputArea.js`
- [ ] 3.2 Set `focus={false}` on the `InputPanel` while the picker is open
- [ ] 3.3 Expose `isPickerOpen()` on the input ref

## 4. Bail in App

- [ ] 4.1 In `src/tui/app.js`, in the conversation-view section of the global `useInput`, return early if `inputAreaRef.current?.isPickerOpen?.()` is true

## 5. Tests

- [ ] 5.1 Add `tests/unit/tui/filePicker.test.js` covering filter derivation, trim/escape of untrusted input, alphabetical sort, replacement logic, and the open/refine/navigate/select/close flow
- [ ] 5.2 Add a test that the App bails when the picker is open

## 6. Verification

- [ ] 6.1 Run `npm run test`
- [ ] 6.2 Run `npm run lint`
- [ ] 6.3 Run `npm run coverage`
