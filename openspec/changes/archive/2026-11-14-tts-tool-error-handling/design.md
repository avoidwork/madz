# Design

## Context

See proposal.md - Why. The `textToSpeechImpl` function in `src/tools/tts/index.js` currently calls `mkdir` and `writeFile` (lines ~119-126) without any error handling, so a filesystem failure throws out of the async function. The helper `callTtsApi` already returns native `{ ok, buffer?, error? }` objects and wraps its own fetch in a try/catch; only the save-to-disk block is unprotected. The `textToSpeech` tool is wrapped by `@langchain/core/tools` `tool()`.

## Goals / Non-Goals

**Goals:**
- `textToSpeechImpl` returns `{ ok: false, error }` on filesystem write failure instead of throwing.
- `speed` is validated as a finite number before the API call.
- The audio buffer length is checked against `config.sandbox.maxWriteSize` before writing.
- The TTS API timeout is configurable (default 15000ms).
- The resolved output path is validated against the sandbox allowlist via `validatePath`.
- The `textToSpeech` schema exposes optional `timeout` and `openaiApiKey` fields.

**Non-Goals:**
- No change to the `callTtsApi` request body shape, the `MEDIA:` path format, or the saved filename convention.
- No change to existing error message text.
- No change to config loading or the `tool()` wrapper.
- No change to the `tts-tool` capability's existing requirements (only additive).

## Decisions

**Decision: Wrap the save block in a single try/catch.**
The `mkdir` and `writeFile` calls are adjacent and both write to disk; a single try/catch around both keeps the change minimal and returns a descriptive `{ ok: false, error }` on any filesystem failure. This mirrors the error-handling style already used in `callTtsApi` and sibling tools.

**Decision: Validate `speed` as a finite number before the API call.**
The schema constrains `speed` to 0.25-4.0, but direct calls to `textToSpeechImpl` bypass the schema. A `typeof speed === "number" && Number.isFinite(speed)` check rejects NaN/Infinity and non-numeric values with a structured error, preventing `null` from being serialized in the request body.

**Decision: Enforce `config.sandbox.maxWriteSize` on the buffer before writing.**
Read `config.sandbox.maxWriteSize` (defaulting to 512000 if absent) and reject buffers larger than the limit before `writeFile`. This prevents writing oversized audio that could exhaust disk or violate the sandbox write budget.

**Decision: Make the timeout configurable via a schema field, defaulting to 15000ms.**
Add a `timeout` parameter to `callTtsApi` (default 15000) and use it in the `setTimeout`. Expose an optional `timeout` field on the schema (bounded min 5000 / max 60000, mirroring `generateImage`) and pass it through from `textToSpeechImpl`. The default stays 15000ms to avoid behavior change.

**Decision: Validate the output path against the sandbox allowlist via `validatePath`.**
Import `validatePath` from `../common.js` and validate the resolved output path against `config.sandbox.paths` (or `options.allowedPaths`) before writing. This mirrors the `audio` and `discovery` tools. If the path is outside the sandbox, return `{ ok: false, error }`.

**Decision: Add optional `openaiApiKey` to the schema.**
Expose `openaiApiKey: z.string().optional()` on the schema for consistency with `generateImage`'s `falApiKey`. The impl already reads `options.openaiApiKey`; this is a schema-level consistency fix.

## Risks / Trade-offs

- [The `tool()` wrapper may stringify the return for the LLM] → The impl still returns native objects; tests import `textToSpeechImpl` directly and assert the native shape.
- [Sandbox path validation may reject the default `memory/tools/` output dir] → The validation is applied to the resolved path; if `config.sandbox.paths` does not include the tools dir, the tool returns a structured error rather than writing outside the sandbox. This is the intended security behavior.
- [Making the timeout configurable could allow callers to set extreme values] → The schema bounds `timeout` to 5000-60000ms, and the default remains 15000ms.

## Migration Plan

No migration needed. This is a localized hardening of `textToSpeechImpl` and its schema, plus additive tests.

## Open Questions

None.
