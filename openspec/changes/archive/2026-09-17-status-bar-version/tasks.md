## 1. StatusBar Component

- [x] 1.1 Add `version` to the destructured props in `src/tui/statusBar.js`
- [x] 1.2 Add a sibling `Box` with `marginLeft: "auto"` after the left `Box`, containing a `Text` that renders `version` only when truthy

## 2. Thread appInfo Through InputArea

- [x] 2.1 Add `appInfo` to the destructured props in `src/tui/inputArea.js`
- [x] 2.2 Pass `appInfo?.version` to `<StatusBar>` in `src/tui/inputArea.js`

## 3. Pass appInfo to InputArea

- [x] 3.1 Add `appInfo` to the `<InputArea>` props in `src/tui/app.js`

## 4. Tests

- [x] 4.1 Add a test in `tests/unit/tui.test.js` rendering `StatusBar` with `version: "1.80.1"` and asserting the version string appears in the output
- [x] 4.2 Verify the existing "does not render app name or version" test still passes

## 5. Verification

- [x] 5.1 Run `npm run test` and confirm no regressions
- [x] 5.2 Run `npm run lint` and confirm no lint/format issues
- [x] 5.3 Run `npm run coverage` and confirm coverage is maintained
