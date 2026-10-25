## Why

madz does not own its file tools. The eight filesystem tools (`ls`, `read_file`, `write_file`, `edit_file`, `delete`, `glob`, `grep`, `execute`) come from deepagents' `createFilesystemMiddleware`, and madz merely wraps that middleware via `createEvictionAwareFilesystemMiddleware` in `src/agent/evictionCeiling.js`. This means madz doesn't control the tool surface, and the library's tools may not respect madz's `allowedPaths` sandbox validation. The `todo` tool shows the better pattern: madz's own implementation, registered as a first-class tool.

## What Changes

- Create `src/tools/file/index.js` exposing a single `file` tool with an `action` key (the `todo`/`memory` pattern).
- Actions: `read`, `write`, `edit`, `delete`, `search`, `ls`, `glob`, `grep`. The `edit` action replaces the old `patch` (renamed for clarity) and applies a unified-diff patch or string replacement.
- Register `file` in `src/tools/index.js` (`TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `TOOLS`, `buildToolConfig` switch). Remove the dead `readFile`/`writeFile`/`patch`/`searchFiles` cases.
- Replace the deepagents filesystem middleware in `src/agent/evictionCeiling.js` so it supplies madz's `file` tool instead of the library's eight. Keep the middleware name `"FilesystemMiddleware"` for same-name merge displacement.
- Reuse `validatePath` + `checkFileLimit` from `src/tools/common.js` so every path is validated against `allowedPaths` and size limits are enforced.
- Add unit + integration tests and update the eviction middleware regression test.

## Capabilities

### New Capabilities
- `own-file-tool`: A single `file` tool with an `action` key that owns and sandboxes madz's file I/O (read, write, edit, delete, search, ls, glob, grep), replacing deepagents' eight built-in filesystem tools.

### Modified Capabilities
- `tool-result-eviction-ceiling`: The eviction-aware filesystem middleware now supplies madz's `file` tool (or no filesystem tools) instead of the library's eight, while keeping the name `"FilesystemMiddleware"`.

## Impact

- `src/tools/file/index.js` (new), `src/tools/index.js`, `src/agent/evictionCeiling.js`, `src/tools/common.js` (reuse).
- Tests: `tests/unit/tools/file.test.js`, `tests/integration/tools/file.test.js`, `tests/unit/evictionCeiling.test.js`.
- No new npm packages; reuses `node:fs/promises` and existing helpers.

## Non-goals

- No `execute` action in the `file` tool — shell execution stays in the `process` tool.
- No patching of the deepagents library dist via postinstall; the middleware replacement is the chosen seam.
- No restoration of the old four-tool `filesystem.js` surface.
