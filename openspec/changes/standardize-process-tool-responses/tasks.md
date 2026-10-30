# Tasks

## 1. Refactor process tool to structured responses

- [x] 1.1 Convert `executeForeground` in `src/tools/process/index.js` to return a native object (`{ ok: true, exitCode, stdout, stderr }` on success, `{ ok: false, error }` on spawn error) and update its JSDoc `@returns`. Verify by running the process unit tests.
- [x] 1.2 Convert `executeBackground` in `src/tools/process/index.js` to return a native object (`{ ok: true, pid, command }` on success, `{ ok: false, error }` on spawn error) and update its JSDoc `@returns`. Verify by running the process unit tests.
- [x] 1.3 Convert every bare-string return in `unifiedProcessImpl` to a native structured object (`{ ok: false, error }` for error paths, `{ ok: true, ... }` for success paths) and update the `@returns` JSDoc. Verify by running the process unit tests.
- [x] 1.4 Convert the `list` action to return `{ ok: true, entries }` instead of `JSON.stringify(entries)`. Verify by running the process unit tests.

## 2. Update process tool unit tests

- [x] 2.1 Update `tests/unit/tools/process.test.js` so success assertions check `result.ok === true` and the relevant payload fields (exitCode, stdout, stderr, pid, command, entries). Verify by running `npm run test`.
- [x] 2.2 Update `tests/unit/tools/process.test.js` so error assertions check `result.ok === false` and `result.error` contains the message. Verify by running `npm run test`.
- [x] 2.3 Update the `list` action test to assert `result.ok === true` and `Array.isArray(result.entries)` instead of `JSON.parse(listResult)`. Verify by running `npm run test`.
- [x] 2.4 Update tests that extracted PIDs via regex from strings to read the structured `result.pid` field. Verify by running `npm run test`.

## 3. Verify no regressions

- [x] 3.1 Run `npm run test` and confirm all tests pass.
- [x] 3.2 Run `npm run lint` and confirm lint passes.
- [x] 3.3 Run `npm run coverage` and confirm line coverage is maintained.
