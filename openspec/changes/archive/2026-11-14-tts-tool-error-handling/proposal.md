# Proposal

## Why

The `textToSpeech` tool in `src/tools/tts/index.js` does not wrap its filesystem write operations (`mkdir`/`writeFile`) in error handling, so a failed write throws out of the async function instead of returning the structured `{ ok: false, error }` object the spec requires. An audit also found related defects: non-numeric `speed` serializes as `null`, the audio buffer is not checked against `config.sandbox.maxWriteSize`, the API timeout is hardcoded, the output path is not validated against the sandbox allowlist, and the schema lacks an `openaiApiKey` field.

## What Changes

- `textToSpeechImpl` in `src/tools/tts/index.js` wraps the `mkdir`/`writeFile` save block in a try/catch and returns `{ ok: false, error }` on filesystem failure instead of throwing.
- `speed` is validated as a finite number before calling `callTtsApi`; non-numeric values return a structured error.
- The audio buffer length is checked against `config.sandbox.maxWriteSize` before writing; oversized buffers return a structured error.
- `callTtsApi` accepts a configurable `timeout` (default 15000ms), exposed via an optional `timeout` field on the schema.
- The resolved output path is validated against the sandbox allowlist via `validatePath` before writing.
- The `textToSpeech` schema exposes an optional `openaiApiKey` field for consistency with `generateImage`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tts-tool`: The `textToSpeech` tool now returns a structured `{ ok: false, error }` on filesystem write failure (instead of throwing), validates `speed` as a finite number, enforces `config.sandbox.maxWriteSize` on the audio buffer, exposes a configurable `timeout`, validates the output path against the sandbox allowlist, and exposes an optional `openaiApiKey` schema field.

## Impact

- **Code**: `src/tools/tts/index.js` — `textToSpeechImpl` (filesystem write try/catch, speed validation, maxWriteSize check, timeout plumbing, path validation) and the `textToSpeech` schema (`timeout`, `openaiApiKey` fields).
- **Tests**: `tests/unit/tools_tts.test.js` — extend to cover filesystem write failure, non-numeric speed rejection, and maxWriteSize enforcement.
- **No breaking API change**: The `tool()` wrapper may still serialize the return for the LLM, but the impl returns native objects as required. Existing error message text and the `MEDIA:` path format are preserved.
