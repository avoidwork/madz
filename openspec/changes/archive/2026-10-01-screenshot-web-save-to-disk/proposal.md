## Why

The `screenshotWeb` tool currently returns a base64 PNG string directly in its tool result. This bloats the conversation with large base64 payloads and cannot be consumed by `readImage`, which reads image files from disk. Saving the screenshot to disk keeps the tool result small and lets `readImage` read the file for vision analysis.

## What Changes

- Add `screenshotsDir: memory/screenshots/` to the `memory:` section of `config.yaml`.
- Add `screenshotsDir: z.string().default("memory/screenshots/")` to `MemorySchema` in `src/config/schemas/memory.js`.
- Create `ensureScreenshotsDir(screenshotsDir, cwdParam = cwd)` in `src/memory/` mirroring `ensureSessionsDir` in `src/session/factory.js`, and export it from `src/memory/index.js`.
- Modify `screenshotWebImpl` in `src/tools/web/index.js` to write the captured PNG to the screenshots directory and return `{ ok: true, mimeType: "image/png", path }` instead of `{ ok: true, mimeType: "image/png", data }`.
- Update the `screenshotWeb` tool description and schema to reflect that it saves to disk and returns a path.
- Update tests in `tests/unit/tools/web.test.js` to assert the new file-path/MIME return shape and add a test for `ensureScreenshotsDir`.

## Capabilities

### New Capabilities
<!-- None introduced -->

### Modified Capabilities
- `screenshot-web`: The `screenshotWeb` tool now saves the captured PNG to disk and returns a file path plus MIME type instead of returning base64-encoded image data.

## Impact

- **Code**: `src/tools/web/index.js` (`screenshotWebImpl`, `screenshotWeb` tool definition), `src/config/schemas/memory.js` (`MemorySchema`), `src/memory/` (new `ensureScreenshotsDir` helper + `index.js` export).
- **Config**: `config.yaml` (`memory.screenshotsDir`).
- **Tests**: `tests/unit/tools/web.test.js`.
- **Dependencies**: `sharp` (existing), `node:fs/promises` (`mkdir`, `writeFile`), `node:path` (`join`).

## Non-goals

- Not changing the resize/byte-budget behavior of `resizeScreenshot`.
- Not adding a filename/output option to the tool schema beyond what is required to save to disk.
- Not modifying `readImage` itself.
