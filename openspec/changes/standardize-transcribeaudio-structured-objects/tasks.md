# Tasks

## 1. Convert impl to native structured objects

- [ ] 1.1 In `src/tools/audio/index.js`, replace each `return JSON.stringify({ ok: false, error: ... })` in `transcribeAudioImpl` (lines 157, 166, 173, 180, 186-189, 202, 209) with a native `return { ok: false, error: ... }`. Verify by reading the file and confirming no `JSON.stringify` remains in the impl.
- [ ] 1.2 Replace the success returns (line 204 and line 211) with native `return { ok: true, text, model, backend }` objects. Verify by reading the file and confirming both success paths return native objects.
- [ ] 1.3 Update the JSDoc `@returns` on `transcribeAudioImpl` (line 151) to `{Promise<{ ok: boolean, text?: string, model?: string, backend?: string, error?: string }>}`. Verify by reading the JSDoc.
- [ ] 1.4 Update the tool wrapper `transcribeAudio` JSDoc `@returns` (line 217) to match the structured shape, and update the `description` string that says "Returns a JSON string" to reflect the structured object return. Verify by reading the file.

## 2. Update unit tests

- [ ] 2.1 In `tests/unit/tools/audio.test.js`, update all assertions that call `JSON.parse(result)` to use the native object directly (e.g., `result.ok`, `result.text`, `result.backend`, `result.error`). Verify by reading the file and confirming no `JSON.parse` remains on the impl result.
- [ ] 2.2 Ensure each error path test (missing path, empty path, path outside sandbox, non-existent file, unsupported extension, size limit, API failure, local failure) asserts the native `{ ok: false, error }` shape. Verify by reading the file.

## 3. Verify

- [ ] 3.1 Run `npm run test` and confirm all tests pass.
- [ ] 3.2 Run `npm run lint` and confirm no lint errors.
- [ ] 3.3 Run `npm run coverage` and confirm coverage is maintained.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
