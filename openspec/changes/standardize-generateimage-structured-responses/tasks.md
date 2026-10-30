# Tasks

## 1. Update generateImageImpl to return native objects

- [ ] 1.1 In `src/tools/image/index.js`, replace each `return JSON.stringify({ ok: false, error: ... })` in `generateImageImpl` (missing prompt, prompt too long, missing API key, FAL error) with a native `return { ok: false, error: ... }`. Verify by reading the file and confirming no `JSON.stringify` remains in the impl.
- [ ] 1.2 Replace the success `return JSON.stringify({ ok: true, imageUrl: result.imageUrl })` with a native `return { ok: true, imageUrl: result.imageUrl }`. Verify by reading the file and confirming the success path returns a native object.
- [ ] 1.3 Update the JSDoc `@returns` on `generateImageImpl` (line 59) from `{Promise<string>} JSON result string` to `{Promise<{ ok: boolean, imageUrl?: string, error?: string }>}`. Verify by reading the file.
- [ ] 1.4 Update the `generateImage` tool wrapper JSDoc `@returns` (line 95) from `{string}` to `{Promise<{ ok: boolean, imageUrl?: string, error?: string }>}`. Verify by reading the file.

## 2. Add/update unit tests

- [ ] 2.1 Add `tests/unit/tools/image/generateImage.test.js` asserting the success path returns `{ ok: true, imageUrl }` as a native object. Verify by running the test.
- [ ] 2.2 Add tests asserting each error path (missing prompt, prompt too long, missing API key, FAL error) returns `{ ok: false, error }` as a native object. Verify by running the tests.

## 3. Verify

- [ ] 3.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions. Verify all three commands pass.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
