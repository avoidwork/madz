## Why

The harness has no way to read an image from disk and hand it to the model. The existing `image` tool (`generateImage`) only generates images via FAL.ai — it does not read local files. To support vision workflows (analyzing a screenshot, photo, or diagram), the agent needs a tool that loads a local image and returns it in a model-consumable form (base64 + MIME type).

## What Changes

- Add a new `readImage` tool that reads a local image file and returns its base64-encoded contents plus MIME type.
- The tool validates the path against the sandbox allowlist, checks the file size against a configurable limit, and reads the file using async `node:fs/promises`.
- Introduce an `image` config section with `maxSize` defaulting to `100kb`, mirroring the `sandbox.maxReadSize` pattern.
- Register the tool in `src/tools/index.js` with `filesystem:read` permission.

## Capabilities

### New Capabilities
- `read-image`: Reading a local image file from disk and returning its base64-encoded contents plus MIME type for LLM vision analysis.

### Modified Capabilities
<!-- None — no existing spec-level behavior changes. -->

## Impact

- **`src/tools/image/readImage.js`** — new tool implementation.
- **`src/tools/index.js`** — register `readImage` in `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, and `TOOLS`.
- **`src/tools/common.js`** — reuse `validatePath`, `parseSizeString`, `checkFileLimit`.
- **`src/config/schemas/image.js`** — new schema with `maxSize`.
- **`src/config/config.js`** — wire `ImageSchema` into `ConfigSchema`.
- **`src/config/schemas/index.js`** — export `ImageSchema`.
- **`config.yaml`** — add `image:` section with `maxSize: 100kb`.
- **`tests/unit/tools/image/readImage.test.js`** — new unit tests.

## Non-goals

- Image generation (already covered by `generateImage`).
- Image analysis/description — the tool only returns bytes; the LLM does the analysis.
- Downscaling or compression of large images.
