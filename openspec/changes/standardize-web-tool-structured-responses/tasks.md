# Tasks

## 1. Convert `searchWebImpl` returns to native objects

- [ ] 1.1 Convert the success return in `searchWebImpl` from `return JSON.stringify({ ok: true, backend, query, results: result.results });` to `return { ok: true, backend, query, results: result.results };` and verify the success-path unit test asserts a native object
- [ ] 1.2 Convert the invalid-query return from `return JSON.stringify({ ok: false, error: "Query is required and must be a non-empty string" });` to `return { ok: false, error: "Query is required and must be a non-empty string" };` and verify the invalid-query unit test asserts a native object
- [ ] 1.3 Convert the backend-error return from `return JSON.stringify({ ok: false, error: result.error });` to `return { ok: false, error: result.error };` and verify the backend-error path returns a native object

## 2. Update JSDoc annotations

- [ ] 2.1 Update `searchWebImpl` JSDoc `@returns {Promise<string>} JSON result string` to `@returns {Promise<object>} Structured result object` and verify the source file documents the native object return
- [ ] 2.2 Update the `searchWeb` tool definition JSDoc `@returns {string} JSON result string` to `@returns {object} Structured result object` and verify the source file documents the native object return

## 3. Update unit tests

- [ ] 3.1 Update `tests/unit/tools/web.test.js` to assert `searchWebImpl` returns a native object (not a string) with shape `{ ok: true, backend, query, results }` on success and `{ ok: false, error }` on failure, and verify `npm run test` passes for the web tool tests

## 4. Verify no regressions

- [ ] 4.1 Run `npm run test` and verify all tests pass
- [ ] 4.2 Run `npm run lint` and verify lint passes
- [ ] 4.3 Run `npm run coverage` and verify coverage is maintained

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
