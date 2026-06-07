## 1. Update Banner to Display Version

- [ ] 1.1 Add `version` prop to Banner component in `src/tui/banner.js`
- [ ] 1.2 Render version string below ASCII art and above the separator/command groups as plain text with no styling (no color, no dim — just default on background)
- [ ] 1.3 Pass `appInfo.version` from `App` to `Banner` in `src/tui/app.js`

## 2. Remove Version from StatusBar

- [ ] 2.1 Remove `appInfo` from the `StatusBar` component props in `src/tui/statusBar.js`
- [ ] 2.2 Remove the conditional rendering of `appInfo.name + appInfo.version` (lines 58-66 in statusBar.js)
- [ ] 2.3 Remove the right-side content area; keep only the left side (status indicator, status message, skill/message counts)

## 3. Update App Component

- [ ] 3.1 Remove `appInfo` from `statusProps` in `src/tui/app.js` (line 437)
- [ ] 3.2 Pass `appInfo ? { version: appInfo.version } : undefined` to Banner (line 457)
- [ ] 3.3 Verify `appInfo` is still accepted as a prop on `App` (it may still be used by other components like InputPanel)

## 4. Update Tests

- [ ] 4.1 Update `tests/unit/tui.test.js` identity rendering tests to reflect that version is no longer in statusBar
- [ ] 4.2 Add a test for Banner displaying the version under the ASCII art
- [ ] 4.3 Add a test confirming StatusBar no longer renders app name/version

## 5. Verify

- [ ] 5.1 Run `npm run lint` to confirm no lint errors
- [ ] 5.2 Run `npm run test` to confirm all tests pass
- [ ] 5.3 Run `npm run coverage` to confirm 100% coverage is maintained
