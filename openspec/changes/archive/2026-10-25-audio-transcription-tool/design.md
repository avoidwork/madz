## Context

madz's media toolset is asymmetric: `readImage` (in), `textToSpeech` (out), `generateImage` (out). There is no audio input path. This design adds a `transcribeAudio` tool that converts an audio file to text, closing that gap. The tool must be sandbox-safe (path validated against `allowedPaths`, size-capped) and work both with and without an API key.

## Goals / Non-Goals

**Goals:**
- Add a `transcribeAudio` tool that converts audio files to text.
- Hybrid backend: OpenAI `audio/transcriptions` when `openaiApiKey` is present; local Whisper via `@xenova/transformers` when not.
- Sandbox-safe: validate path via `validatePath`, enforce size cap via `checkFileLimit`.
- Register the tool in `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `TOOLS`, and the `buildToolConfig` switch.

**Non-Goals:**
- No changes to existing media tools.
- No new npm dependency (reuse `@xenova/transformers` already present).
- No streaming transcription output.

## Decisions

### Decision 1: Hybrid backend (API-first, local fallback)
- **Choice:** Prefer the OpenAI `audio/transcriptions` endpoint when `openaiApiKey` is present; otherwise fall back to a local Whisper pipeline via `@xenova/transformers`.
- **Rationale:** The API path is more accurate and faster for real use; the local path keeps the tool usable offline and keyless. This mirrors the issue's "Alternatives Considered" and the existing `textToSpeech` gating pattern.
- **Alternatives considered:**
  - *Local-only Whisper* — no API key needed, but heavy model download and CPU cost. Rejected: hybrid is more flexible.
  - *Shell out to `whisper` via `process`* — bypasses sandbox path validation and is fragile. Rejected: a first-class tool is more robust.

### Decision 2: Always register the tool (no API-key gate)
- **Choice:** Register `transcribeAudio` unconditionally in `buildToolConfig`, unlike `textToSpeech` which is dropped without a key.
- **Rationale:** The tool has a keyless local fallback, so it is always usable. The API path is only exercised when the key is present.
- **Alternatives considered:** *Gate on the API key like `textToSpeech`* — rejected because it would make the tool unavailable offline.

### Decision 3: Reuse `validatePath` + `checkFileLimit` from `src/tools/common.js`
- **Choice:** Use the existing sandbox helpers rather than reimplementing path validation.
- **Rationale:** DRY. The helpers already enforce `allowedPaths` and the size cap, matching the `readImage` pattern.

### Decision 4: Local Whisper via `@xenova/transformers` with WASM shim
- **Choice:** Use the `automatic-speech-recognition` pipeline with `Xenova/whisper-tiny.en` (quantized), mirroring the lazy-load + `redirectOnnxRuntime` WASM shim pattern in `src/vector/embedder.js`.
- **Rationale:** `@xenova/transformers` is already a dependency (v2.17.2). The WASM shim is required for Alpine/musl compatibility (the project's Docker base).
- **Alternatives considered:** *`whisper.cpp`* — a system dependency, not present. Rejected.

## Risks / Trade-offs

- **Local Whisper model download failure** → Return a clear error; do not crash. The lazy-load pattern in `embedder.js` already handles this by returning `null` on failure.
- **Large audio files** → Enforce `checkFileLimit` size cap before reading. The API path also has a 25MB limit enforced by OpenAI.
- **No API key AND local pipeline unavailable** → Return `{ ok: false, error }` with a clear message.
- **Non-audio / undecodable files** → Return a clear error rather than throwing.
- **WASM shim complexity** → Mirrors the proven `embedder.js` pattern; the shim is isolated in a helper.
