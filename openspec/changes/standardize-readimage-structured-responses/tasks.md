# Tasks

## 1. Refactor readImageImpl return shape

- [ ] 1.1 Convert the four error returns in `readImageImpl` from `JSON.stringify({ ok: false, error: ... })` to native `{ ok: false, error: ... }` objects and verify no `JSON.stringify` remains in the function
- [ ] 1.2 Convert the success return to `{ ok: true, content: [{ type: "image_url", image_url: { url: dataUri } }] }` and verify the content-block array is preserved
- [ ] 1.3 Update the JSDoc `@returns` annotation to `Promise<{ ok: boolean, content?: Array, error?: string }>` and verify it matches the new shape

## 2. Update tests

- [ ] 2.1 Update `tests/unit/tools/image/readImage.test.js` to assert `result.ok === true` and `result.content[0].image_url.url` on success, and update the `b64` helper to read `r.content[0].image_url.url`; verify the test file passes
- [ ] 2.2 Update `tests/unit/tools/image/imageFlow.test.js` to assert `result.ok === true` and `result.content[0].type === "image_url"`; verify the test file passes
- [ ] 2.3 Add failure-path tests to `readImage.test.js` asserting `result.ok === false` with a non-empty `result.error` for missing path, invalid path, file not found, and read failure; verify the new tests pass

## 3. Verify

- [ ] 3.1 Run `npm run test` and verify all tests pass
- [ ] 3.2 Run `npm run lint` and verify lint passes
- [ ] 3.3 Run `npm run coverage` and verify coverage is maintained

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
