## 1. Dependency Setup

- [x] 1.1 Run `npm install fast-glob` to promote `fast-glob` to a direct dependency in `package.json`

## 2. File Picker Component

- [x] 2.1 Create `src/tui/filePicker.js` exporting a `FilePicker` component
- [x] 2.2 Implement `deriveFilter(value, cursor)` — cursor-aware token derivation returning `{ filter, tokenStart, tokenEnd, active }`
- [x] 2.3 Implement `replaceToken(value, tokenStart, tokenEnd, path)` — replaces the `@` token with the selected path, quoting if it contains whitespace
- [x] 2.4 Implement `FilePicker` with a single `useInput` handler owning printable chars (insert at cursor), backspace (delete before cursor), left/right (move cursor), up/down (navigate list), Enter (select), Escape (close)
- [x] 2.5 Render the input text with a cursor indicator (replicating `ink-text-input`'s inverse cursor)
- [x] 2.6 Glob the cwd once with `fast-glob` (`**/*`, excluding `node_modules`/`.git`/`dist`, `onlyFiles: true`, depth cap), cache the result, and filter in JS
- [x] 2.7 Debounce the initial glob at ~250ms on filter change
- [x] 2.8 Render up to 3 visible options with a rotating window and the `▸` indicator (mirroring `ink-select-input`'s `limit` behavior)

## 3. Wire Into InputArea

- [x] 3.1 Render `FilePicker` below the `InputPanel` in `src/tui/inputArea.js` when open
- [x] 3.2 Set `focus={false}` on the `InputPanel` while the picker is open
- [x] 3.3 Expose `isPickerOpen()` on the input ref via `useImperativeHandle`

## 4. App-Level Bail

- [x] 4.1 In `src/tui/app.js`, in the conversation-view section of the global `useInput`, return early if `inputAreaRef.current?.isPickerOpen?.()` is true so up/down and Escape don't steal keys from the picker

## 5. Tests

- [x] 5.1 Add `tests/unit/tui/filePicker.test.js` covering filter derivation, trim/escape of untrusted input, alphabetical sort, replacement logic, and the open/refine/navigate/select/close flow
- [x] 5.2 Add a test that the App bails when the picker is open

## 6. Verification

- [x] 6.1 Run `npm run test` and confirm all tests pass
- [x] 6.2 Run `npm run lint` and confirm no lint errors
- [x] 6.3 Run `npm run coverage` and confirm coverage is maintained
