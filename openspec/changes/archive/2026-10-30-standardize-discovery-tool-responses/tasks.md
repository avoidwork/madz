# Tasks

## 1. Refactor impl functions to structured returns

- [x] 1.1 Update JSDoc `@returns` annotations for `lsImpl`, `globImpl`, `grepImpl`, and `discoveryImpl` to `{Promise<{ok: boolean, ...}>}` and verify the file parses (`node --check src/tools/discovery/index.js`).
- [x] 1.2 Convert `lsImpl` to return `{ ok: true, entries }` on success and `{ ok: false, error }` on failure, and verify the unit test for the ls action passes.
- [x] 1.3 Convert `globImpl` to return `{ ok: true, matches }` on success, `{ ok: true, matches: [] }` for no-match, and `{ ok: false, error }` on failure, and verify the unit test for the glob action passes.
- [x] 1.4 Convert `grepImpl` to return `{ ok: true, matches, count }` on success, `{ ok: true, matches: [], count: 0 }` for no-match, and `{ ok: false, error }` on failure, and verify the unit test for the grep action passes.
- [x] 1.5 Convert `nativeSearch` to return `{ ok: true, matches, count }` and verify the native fallback unit test passes.
- [x] 1.6 Convert `discoveryImpl` to return `{ ok: false, error }` for the unknown-action case and verify the dispatch unit test passes.

## 2. Update tests

- [x] 2.1 Update `tests/unit/tools/discovery.test.js` to assert `{ ok: true, ... }` / `{ ok: false, error: ... }` shapes and verify `npm run test` passes for the discovery unit test.
- [x] 2.2 Update `tests/integration/tools/discovery.test.js` to assert structured shapes and verify the integration test passes.

## 3. Verify

- [x] 3.1 Run `npm run test` and confirm all tests pass.
- [x] 3.2 Run `npm run lint` and confirm lint and formatting pass.
- [x] 3.3 Run `npm run coverage` and confirm coverage is maintained.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
