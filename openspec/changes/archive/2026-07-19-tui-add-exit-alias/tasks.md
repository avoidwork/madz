## 1. Implement /exit command alias

- [x] 1.1 Add `#register("exit", ...)` in `src/tui/commandParser.js` constructor with the same handler as `/quit`
- [x] 1.2 Update `src/tui/banner.js` to list both `/quit` and `/exit` in the help text

## 2. Add tests

- [x] 2.1 Add a unit test in `tests/unit/tui.test.js` verifying `/exit` returns `{ action: "quit", value: true, message: "Quitting." }`

## 3. Verify

- [x] 3.1 Run `npm run test` to ensure all tests pass
- [x] 3.2 Run `npm run lint` to ensure no lint errors
- [x] 3.3 Verify the application starts without crashing
