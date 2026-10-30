# Tasks

## 1. Convert browserImpl returns to native objects

- [x] 1.1 Convert the URL-rejected return in `browserImpl` from `JSON.stringify({ ok: false, error: ... })` to `{ ok: false, error: ... }` and verify the unit test for invalid URL passes
- [x] 1.2 Convert the close return from `JSON.stringify({ ok: true, action: "close" })` to `{ ok: true, action: "close" }` and verify the close unit test passes
- [x] 1.3 Convert the success return from `JSON.stringify({ ...result, sessionId })` to `{ ...result, sessionId }` and verify the success-path unit tests pass
- [x] 1.4 Convert the catch return from `JSON.stringify({ ok: false, error: ..., sessionId })` to `{ ok: false, error: ..., sessionId }` and verify the error-path unit test passes

## 2. Update JSDoc return annotations

- [x] 2.1 Update `browserImpl` `@returns {Promise<string>} JSON result string` to `@returns {Promise<object>} Structured result object` and verify the file lints clean
- [x] 2.2 Update the `browser` tool definition `@returns {string} JSON result string` to `@returns {object} Structured result object` and verify the file lints clean

## 3. Update unit tests to assert native object shape

- [x] 3.1 Replace all `JSON.parse(result)` calls in `tests/unit/tools/browser.test.js` with direct property access on the returned native object and verify the browser unit tests pass
- [x] 3.2 Add assertions that the returned value is a native object (`typeof result === "object"` and not a string) on both success and failure paths and verify the browser unit tests pass

## 4. Verify no regressions

- [x] 4.1 Run `npm run test` and verify it passes
- [x] 4.2 Run `npm run lint` and verify it passes
- [x] 4.3 Run `npm run coverage` and verify it passes (or maintains existing coverage)

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
