## 1. Update Banner to Display Version

- [x] 1.1 Add `version` prop to Banner component in `src/tui/banner.js`
- [x] 1.2 Render version string below ASCII art and above the separator/command groups as plain text with no styling (no color, no dim — just default on background)
- [x] 1.3 Pass `appInfo.version` from `App` to `Banner` in `src/tui/app.js`

## 2. Remove Version from StatusBar

- [x] 2.1 Remove `appInfo` from the `StatusBar` component props in `src/tui/statusBar.js`
- [x] 2.2 Remove the conditional rendering of `appInfo.name + appInfo.version` (lines 58-66 in statusBar.js)
- [x] 2.3 Remove the right-side content area; keep only the left side (status indicator, status message, skill/message counts)

## 3. Update App Component

- [x] 3.1 Remove `appInfo` from `statusProps` in `src/tui/app.js` (line 437)
- [x] 3.2 Pass `appInfo ? { version: appInfo.version } : undefined` to Banner (line 457)
- [x] 3.3 Verify `appInfo` is still accepted as a prop on `App` (it may still be used by other components like InputPanel)

## 4. Update Tests

- [x] 4.1 Update `tests/unit/tui.test.js` identity rendering tests to reflect that version is no longer in statusBar
- [x] 4.2 Add a test for Banner displaying the version under the ASCII art
- [x] 4.3 Add a test confirming StatusBar no longer renders app name/version

## 5. Verify

- [x] 5.1 Run `npm run lint` to confirm no lint errors
- [x] 5.2 Run `npm run test` to confirm all tests pass
- [x] 5.3 Run `npm run coverage` to confirm 100% coverage is maintained
