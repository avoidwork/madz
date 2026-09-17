## Context

The madz harness registers tools in `src/tools/index.js` and exposes them to the agent. The existing `image` tool (`generateImage`) only generates images via FAL.ai. There is no tool that reads a local image from disk and returns it in a model-consumable form. To support vision workflows, the agent needs a `readImage` tool.

The tool must follow the established patterns: a Zod input schema, an async impl function, sandbox path validation, and size enforcement. It must use async `node:fs/promises` per AGENTS.md §1.1 (no blocking `fs.readFileSync`/`fs.statSync` in async functions).

## Goals / Non-Goals

**Goals:**
- Add a `readImage` tool that reads a local image file and returns `{ ok, mimeType, data }` where `data` is base64.
- Validate the path against the sandbox allowlist using `validatePath`.
- Enforce a configurable size limit `image.maxSize` (default `100kb`) using `parseSizeString`/`checkFileLimit`.
- Use async `node:fs/promises` exclusively.
- Register the tool in `src/tools/index.js` with `filesystem:read` permission.
- Introduce an `image` config section with `maxSize`.

**Non-Goals:**
- Image generation (covered by `generateImage`).
- Image analysis/description — the tool returns bytes; the LLM does the analysis.
- Downscaling or compression of large images.

## Decisions

### Decision 1: Return base64 inline with MIME type
Return `{ ok, mimeType, data }` where `data` is the base64 payload. The MIME type is required for the LLM to decode the base64 correctly. Alternatives (file path, public URL) were rejected because the LLM cannot read local files and the image may not be hosted.

### Decision 2: Size cap via config
Enforce `config.image.maxSize` (default `100kb`). Base64 inflates ~33%, so a large image would blow the context window (a 100KB image is ~35k–45k tokens). The cap mirrors the existing `sandbox.maxReadSize` pattern.

### Decision 3: Reuse existing helpers
Reuse `validatePath`, `parseSizeString`, and `checkFileLimit` from `src/tools/common.js` rather than reimplementing path validation and size parsing.

### Decision 4: Async fs/promises
Use `node:fs/promises` (`readFile`, `stat`, `access`) exclusively. No synchronous fs operations — per AGENTS.md §1.1.

### Decision 5: Live in existing image directory
Place the tool at `src/tools/image/readImage.js`, exported alongside `generateImage` from the same directory.

## Risks / Trade-offs

- **Large images** → Mitigated by the `image.maxSize` cap; the tool rejects files over the limit with a clear error.
- **Non-image files** → The tool detects MIME type from extension/magic bytes; unsupported types are rejected or handled gracefully.
- **Path traversal** → Mitigated by `validatePath` against the sandbox allowlist.
- **Missing/unreadable files** → Handled with clear error messages via `checkFileLimit` and `readFile` error handling.
