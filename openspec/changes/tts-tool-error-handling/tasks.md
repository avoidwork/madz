# Tasks

## 1. Harden textToSpeechImpl error handling

- [x] 1.1 Wrap the `mkdir`/`writeFile` save block in `textToSpeechImpl` (src/tools/tts/index.js) in a try/catch that returns `{ ok: false, error: <descriptive message> }` on failure, and verify the success path still returns `{ ok: true, path: "MEDIA:<filePath>", model, voice }`
- [x] 1.2 Add a finite-number validation for `speed` before calling `callTtsApi`, returning `{ ok: false, error }` for non-numeric/NaN/Infinity values, and verify a non-numeric speed returns a structured error
- [x] 1.3 Check `result.buffer.length` against `config.sandbox.maxWriteSize` (default 512000) before writing, returning `{ ok: false, error }` if exceeded, and verify an oversized buffer returns a structured error

## 2. Make timeout configurable and add sandbox path validation

- [x] 2.1 Add a `timeout` parameter to `callTtsApi` (default 15000) and use it in the `setTimeout`, then plumb a configurable timeout from `textToSpeechImpl`, and verify the timeout is honored
- [x] 2.2 Import `validatePath` from `../common.js` and validate the resolved output path against `config.sandbox.paths` (or `options.allowedPaths`) before writing, returning `{ ok: false, error }` if outside the sandbox, and verify an out-of-sandbox path returns a structured error

## 3. Update the textToSpeech schema

- [x] 3.1 Add an optional `timeout` field (bounded min 5000 / max 60000) to the `textToSpeech` schema, and verify the schema accepts it
- [x] 3.2 Add an optional `openaiApiKey` field to the `textToSpeech` schema, and verify the schema exposes it

## 4. Extend unit tests

- [x] 4.1 Add a test to `tests/unit/tools_tts.test.js` that a filesystem write failure (mkdir/writeFile throws) returns `{ ok: false, error }` and does not throw, and verify the test passes
- [x] 4.2 Add tests for non-numeric speed rejection and maxWriteSize enforcement, and verify they pass
- [x] 4.3 Verify all existing tests in `tests/unit/tools_tts.test.js` still pass

## 5. Verify no regressions

- [x] 5.1 Run `npm run test` and verify all tests pass
- [x] 5.2 Run `npm run lint` and verify oxlint and oxfmt pass
- [x] 5.3 Run `npm run coverage` and verify coverage completes without new failures

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
