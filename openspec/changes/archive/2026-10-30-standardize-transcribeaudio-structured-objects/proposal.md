# Proposal

## Why

The `transcribeAudio` tool currently returns a `JSON.stringify({ ok, text, backend })` string from `transcribeAudioImpl`. This forces every caller to parse the response before it can be used, is inconsistent with tools that return native objects, and makes error handling fragile — a stringified error cannot be inspected as a structured object.

## What Changes

- **BREAKING**: `transcribeAudioImpl` in `src/tools/audio/index.js` now returns a native structured object on every path instead of a `JSON.stringify`-wrapped string.
  - On success (API backend): `{ ok: true, text, model: "whisper-1", backend: "api" }`.
  - On success (local backend): `{ ok: true, text, model: WHISPER_MODEL, backend: "local" }`.
  - On every failure path: `{ ok: false, error: <message> }`.
- Update the JSDoc `@returns` on `transcribeAudioImpl` and the `transcribeAudio` tool wrapper to document the structured shape.
- Update the tool `description` string to reflect the structured object return.
- Update `tests/unit/tools/audio.test.js` to assert the native object shape (no `JSON.parse`) on success and each error path.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `audio-transcription`: the "Transcribe audio file to text" requirement changes from "returning the transcribed text as a JSON string" to "returning a native structured object `{ ok, text, model, backend }` on success and `{ ok, error }` on failure."

## Impact

- `src/tools/audio/index.js` — `transcribeAudioImpl` return values and JSDoc; tool wrapper JSDoc and description.
- `tests/unit/tools/audio.test.js` — update assertions to use the native object shape.
- No change to helper functions `callTranscribeApi` and `transcribeLocal` (already return native objects).
- No change to the tool's Zod schema, name, or registration.

## Non-goals

- No change to the `transcribeAudio` tool's input schema, name, or registration in `src/tools/index.js`.
- No change to other tools or the helper functions.
- No wrapper class introduced — a plain structured object is sufficient.
