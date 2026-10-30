# Tasks

## 1. Update clarifyImpl return contract

- [x] 1.1 Convert the `JSON.stringify({...})` return in `clarifyImpl` (src/tools/clarify/index.js line 73) to a native object `{ ok: true, answered: true, question, ...(choices), answer, source }` and verify the clarify unit tests pass
- [x] 1.2 Wrap the `clarifyImpl` body in a try/catch that returns `{ ok: false, error }` on failure and verify the failure-path test passes
- [x] 1.3 Update the JSDoc `@returns` annotations (line 35 `@returns {Promise<string>}` → `@returns {Promise<object>}`; line 85 `@returns {string}` → `@returns {object}`) and verify lint passes

## 2. Update clarify unit tests

- [x] 2.1 Update the `runClarifyInGraph` helper in tests/unit/tools_clarify.test.js to stop calling `JSON.parse(raw)` and use the native object directly, and verify the clarify tests pass
- [x] 2.2 Add `assert.strictEqual(result.ok, true)` assertions to the success-path tests and add a failure-path test asserting `{ ok: false, error }`, and verify the clarify tests pass

## 3. Verify no regressions

- [x] 3.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and verify all pass with maintained coverage
