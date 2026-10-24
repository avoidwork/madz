## 1. Fix the command picker render

- [x] 1.1 In `src/tui/commandPicker.js`, change the render branch so that when `filteredCommands.length === 0`, it renders `null` instead of the gray `" No matching commands."` Text element.

## 2. Add tests

- [x] 2.1 Add a `CommandPicker render` describe block to `tests/unit/tui/commandPicker.test.js` using `renderToString` from `ink`, asserting the `" No matching commands."` text is never present.
- [x] 2.2 Add a render test asserting the typed input line always renders.
- [x] 2.3 Add a `deriveCommandFilter` precondition test for a typo filter that matches no commands (e.g. `/confg`), asserting it is still active so the empty branch is reachable.

## 3. Verify

- [x] 3.1 Run `npm run test` and confirm no regressions.
- [x] 3.2 Run `npm run coverage` and confirm coverage is maintained.
