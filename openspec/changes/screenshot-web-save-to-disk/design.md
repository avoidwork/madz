## Context

The `screenshotWeb` tool currently returns a base64 PNG string directly in its tool result. This bloats the conversation with large base64 payloads and cannot be consumed by `readImage`, which reads image files from disk. The fix is to save the captured PNG to disk under `memory/screenshots/` and return the file path plus MIME type.

The project already has a well-established pattern for ensuring a directory exists before writing: `ensureSessionsDir` in `src/session/factory.js` (and `ensureToolsDir` in `src/memory/tools.js`). Both join the configured dir against the project cwd and call `mkdir(dir, { recursive: true })`.

## Goals / Non-Goals

**Goals:**
- Add a `memory.screenshotsDir` config option with a sensible default.
- Create an `ensureScreenshotsDir` helper mirroring `ensureSessionsDir`.
- Modify `screenshotWebImpl` to write the resized PNG to disk and return `{ ok: true, mimeType: "image/png", path }`.
- Update the tool description/schema and tests.

**Non-Goals:**
- Changing the resize/byte-budget behavior of `resizeScreenshot`.
- Adding a filename/output option to the tool schema beyond what is required to save to disk.
- Modifying `readImage` itself.

## Decisions

**Decision: Reuse `resizeScreenshot` to produce the bytes, then write them to disk.**
The existing `resizeScreenshot` already resizes/re-encodes the PNG via `sharp` and returns base64. The new flow reuses it to produce the bytes, then writes them to disk instead of returning them. This keeps the resize/byte-budget behavior intact and avoids duplicating the sharp pipeline.

**Decision: Mirror `ensureSessionsDir` for the new `ensureScreenshotsDir` helper.**
The helper lives in `src/memory/` (a new `screenshots.js` module) and is exported from `src/memory/index.js` for consistency with `ensureToolsDir`. It joins the configured dir against the project cwd and calls `mkdir(dir, { recursive: true })`.

**Decision: Generate a unique filename per capture.**
The screenshot is written to `join(cwd, config.memory.screenshotsDir, <filename>)`. A unique filename (e.g., a timestamp/UUID-based slug) avoids collisions across captures.

**Decision: Return the absolute path.**
The tool returns `{ ok: true, mimeType: "image/png", path }` where `path` is the absolute path to the saved file, so `readImage` can read it without a path-validation failure.

## Risks / Trade-offs

- [Screenshots accumulate on disk] → Mitigation: screenshots live under `memory/screenshots/` with the rest of the project's persistent state; a future GC/cleanup concern is out of scope.
- [Write failure leaves a partial file] → Mitigation: the tool returns `{ ok: false, error }` on write failure; the directory is created recursively before writing.
- [Path resolution must stay within sandbox scope] → Mitigation: the path is built from `cwd` + the configured relative `screenshotsDir`, which resolves within the project root so `readImage` can read it.
