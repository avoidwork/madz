# Tasks

## 1. Update samplingImpl to return native structured objects

- [x] 1.1 In `src/tools/sampling/index.js`, change the success return at line ~154 from `return JSON.stringify(result);` to `return result;` and verify the returned value is a native object (not a string) via the updated unit test
- [x] 1.2 Change the three failure returns (empty content, cooldown, capacity) from `return JSON.stringify({ ok: false, error: ... });` to `return { ok: false, error: ... };` and verify each returns a native object via the updated unit tests
- [x] 1.3 Update the JSDoc `@returns` annotation on `samplingImpl` from `{Promise<string>} Result JSON string` to `{Promise<object>} Structured result object` and verify the annotation reads correctly

## 2. Update the sampling tool singleton wrapper

- [x] 2.1 In `src/tools/sampling/index.js`, replace `const parsed = JSON.parse(result);` with `const parsed = result;` in the `sampling` wrapper and verify the `_lastWritten` update logic still works via the success-path unit test

## 3. Update unit tests to assert structured object shape

- [x] 3.1 In `tests/unit/tools_sampling.test.js`, update the `samplingImpl` tests to assert the returned value is a native object (not a string) with shape `{ ok: true, ... }` on success and `{ ok: false, error }` on failure, and verify `npm run test` passes for the sampling tests

## 4. Verify

- [x] 4.1 Run `npm run test` and confirm all tests pass
- [x] 4.2 Run `npm run lint` and confirm no lint errors
- [x] 4.3 Run `npm run coverage` and confirm line coverage is maintained
