# Tasks

## 1. Refactor impl functions to structured responses

- [x] 1.1 Convert `readImpl` in `src/tools/file/index.js` to return `{ ok: true, content, lines }` on success and `{ ok: false, error }` on failure; update JSDoc `@returns`. Verify by running the read unit tests.
- [x] 1.2 Convert `writeImpl` in `src/tools/file/index.js` to return `{ ok: true, path, bytesWritten }` on success and `{ ok: false, error }` on failure; update JSDoc `@returns`. Verify by running the write unit tests.
- [x] 1.3 Convert `editImpl` in `src/tools/file/index.js` to return `{ ok: true, changes, diff }` on success and `{ ok: false, error, suggestions? }` on failure; update JSDoc `@returns`. Verify by running the edit unit tests.
- [x] 1.4 Convert `deleteImpl` in `src/tools/file/index.js` to return `{ ok: true, path }` on success and `{ ok: false, error }` on failure; update JSDoc `@returns`. Verify by running the delete unit tests.
- [x] 1.5 Convert `fileImpl` in `src/tools/file/index.js` to return `{ ok: false, error }` for unknown actions; update JSDoc `@returns`. Verify by running the fileImpl dispatch unit tests.

## 2. Update tests

- [x] 2.1 Update `tests/unit/tools/file.test.js` to assert `{ ok: true, ... }` / `{ ok: false, error: ... }` shapes for all impls. Verify by running `npm run test`.
- [x] 2.2 Update `tests/integration/tools/file.test.js` to assert structured object shapes for the round-trip and dispatch tests. Verify by running `npm run test`.

## 3. Verify

- [x] 3.1 Run `npm run test` and confirm all tests pass.
- [x] 3.2 Run `npm run lint` and confirm no lint errors.
- [x] 3.3 Run `npm run coverage` and confirm coverage is maintained.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
