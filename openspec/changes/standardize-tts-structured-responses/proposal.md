# Proposal

## Why

The `textToSpeech` tool currently returns a `JSON.stringify({ ok, path, model, voice })` string from `textToSpeechImpl`. This forces every caller to parse the response before use, is inconsistent with tools that return native objects, and makes error handling fragile — a stringified error cannot be inspected as a structured object.

## What Changes

- `textToSpeechImpl` in `src/tools/tts/index.js` returns a native structured object on both success and failure instead of a `JSON.stringify`-wrapped string.
- On success, returns `{ ok: true, path, model, voice }` as a native object.
- On failure, returns `{ ok: false, error: ... }` with a descriptive error message.
- JSDoc `@returns` annotations for `textToSpeechImpl` and the `textToSpeech` tool wrapper are updated to document the structured shape.
- Unit tests in `tests/unit/tools_tts.test.js` are updated to assert the native object shape directly, removing `JSON.parse(result)` calls.

## Capabilities

### New Capabilities
- `tts-tool`: Owns the behavior of the `textToSpeech` tool — converting text to speech via OpenAI TTS, saving the audio to `config.memory.toolsDir`, and returning a structured `{ ok, path?, model?, voice?, error? }` result object.

### Modified Capabilities
<!\-\- No existing capability's requirements change. \-\->

## Impact

- **Code**: `src/tools/tts/index.js` — `textToSpeechImpl` return statements and JSDoc.
- **Tests**: `tests/unit/tools_tts.test.js` — assertions updated to read native object properties.
- **No breaking API change**: The `tool()` wrapper may still serialize the return for the LLM, but the impl returns native objects as required.
