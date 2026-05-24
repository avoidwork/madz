## 1. Banner component

- [ ] 1.1 Create Banner component in `src/tui/components.js` with ASCII art logo and command help listing grouped commands (chat, provider, memory, schedule, config, context, quit, help)
- [ ] 1.2 Export Banner from `src/tui/index.js`

## 2. App integration

- [ ] 2.1 Add `showBanner` state (boolean, default `true`) and `handleDismissBanner` handler in `src/tui/app.js`
- [ ] 2.2 Conditionally render Banner at the top of the App layout when `showBanner` is `true`, otherwise render ConversationPanel
- [ ] 2.3 Add `useInput` handler to dismiss the banner on any key press (only when `showBanner` is `true`, do not swallow normal input when banner is dismissed)

## 3. Tests

- [ ] 3.1 Add unit test for Banner rendering the correct ASCII art and command groups in `tests/unit/tui.test.js`
- [ ] 3.2 Add unit test confirming Banner dismisses and sets `showBanner` to `false` on key press
- [ ] 3.3 Ensure all tests pass with 100% coverage via `npm run coverage`
