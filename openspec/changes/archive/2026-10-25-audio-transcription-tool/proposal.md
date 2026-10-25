## Why

madz's media toolset is asymmetric: `readImage` (in), `textToSpeech` (out), `generateImage` (out) — there is no audio *input*. A voice memo, meeting recording, or podcast is dead to the agent. Adding transcription unlocks an entire class of tasks the agent currently cannot touch.

## What Changes

- Add a `transcribeAudio` tool (`src/tools/audio/index.js`) that converts an audio file to text.
- Input: `path` (required, validated against the sandbox allowlist), optional `language` hint, optional `prompt` for context.
- Output: `{ ok: true, text, model, backend }` on success, or `{ ok: false, error }` on failure.
- Hybrid backend: OpenAI `audio/transcriptions` when `openaiApiKey` is present; local Whisper via `@xenova/transformers` otherwise.
- Register in `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `TOOLS`, and the `buildToolConfig` switch in `src/tools/index.js`.
- Reuse `validatePath` + `checkFileLimit` from `src/tools/common.js` for sandbox path validation and size capping.

## Capabilities

### New Capabilities
- `audio-transcription`: The `transcribeAudio` tool that converts audio files to text, with hybrid API/local backend selection and sandbox path validation.

### Modified Capabilities
<!\-\- No existing spec-level behavior changes. \-\->

## Impact

- **Code**: `src/tools/audio/index.js` (new), `src/tools/index.js` (registration).
- **Dependencies**: `@xenova/transformers` (already present, v2.17.2) for local Whisper; existing `openaiApiKey` for the API path. No new npm packages.
- **Config**: `config.providers.openai.credentials.apiKey` (env-resolved) gates the API path.
- **Tests**: `tests/unit/tools/audio.test.js`, `tests/integration/tools/audio.test.js`.

## Non-goals

- No changes to existing media tools (`readImage`, `textToSpeech`, `generateImage`).
- No new npm dependency beyond what is already present.
- No streaming transcription output; the tool returns the full transcript as a single string.
