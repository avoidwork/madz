# Tasks

## 1. Update textToSpeechImpl return values

- [x] 1.1 Replace each `return JSON.stringify({ ok: false, error: ... })` in `textToSpeechImpl` (missing text, empty text, text too long, missing API key, invalid model, invalid voice, API error) with a native `return { ok: false, error: ... }` and verify no `JSON.stringify` remains in the function body
- [x] 1.2 Replace the success `return JSON.stringify({ ok: true, path, model, voice })` with a native `return { ok: true, path, model, voice }` and verify the success path returns a native object

## 2. Update JSDoc annotations

- [x] 2.1 Update `textToSpeechImpl` `@returns` to `{Promise<{ ok: boolean, path?: string, model?: string, voice?: string, error?: string }>}` and verify no `JSON result string` reference remains
- [x] 2.2 Update the `textToSpeech` tool wrapper `@returns` to document the structured object shape and verify it no longer says `{string}`

## 3. Update unit tests

- [x] 3.1 Update `tests/unit/tools_tts.test.js` to remove all `JSON.parse(result)` calls and assert native object properties (`result.ok`, `result.error`, `result.path`) directly, and verify the test file passes
- [x] 3.2 Verify all existing test cases (requires text, empty text, long text, missing API key, invalid model, invalid voice, API success, saves audio, API failure, network error) still pass with the native object assertions

## 4. Verify no regressions

- [x] 4.1 Run `npm run test` and verify all tests pass
- [x] 4.2 Run `npm run lint` and verify oxlint and oxfmt pass
- [x] 4.3 Run `npm run coverage` and verify coverage completes without new failures

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
