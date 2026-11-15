# Proposal

## Why

The harness has ZIP **extraction** for document formats (`src/tools/fileExtract/zipExtractor.js` uses `adm-zip`), but no general-purpose archive tool. There is no way to **create** a zip/tar/gzip archive, no tar/gzip support at all, and no extract-to-disk capability. Shelling out via `process` risks injection and bypasses sandbox validation.

## What Changes

- Add a new `archive` tool (`src/tools/archive/index.js`) supporting `create`, `extract`, and `list` operations across `zip`, `tar`, and `gzip` formats.
- Register the tool in `src/tools/index.js` (import, `TOOLS` map, `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, and a `case "archive"` in `buildToolConfig()`).
- Enforce sandbox allowlist on source/destination paths via `validatePath()` from `src/tools/common.js`, with path-traversal protection during extraction (A01 Broken Access Control).
- Add unit tests (`tests/unit/tools/archive.test.js`) and an integration round-trip test (`tests/integration/tools/archive.test.js`).
- Add dependencies: `archiver` (create), `unzipper` (zip extract), `tar` (tar/gzip extract).

## Capabilities

### New Capabilities
- `archive-tool`: General-purpose archive operations — creating, extracting, and listing zip/tar/gzip archives with sandbox allowlist enforcement and path-traversal protection.

### Modified Capabilities
<!-- No existing capability changes; `file-extraction` stays scoped to document formats. -->

## Impact

- **Code**: `src/tools/archive/index.js` (new), `src/tools/index.js` (registry wiring).
- **Tests**: `tests/unit/tools/archive.test.js`, `tests/integration/tools/archive.test.js` (new).
- **Dependencies**: `archiver`, `unzipper`, `tar` added to `package.json`.
- **Security**: Path traversal protection on extract; no shell interpolation; Zod input validation.

## Non-goals

- Not modifying `file-extraction` / `fileExtract` — that path stays scoped to reading document content (DOCX/PPTX/XLSX/PDF).
- Not adding archive support to the `process` tool.
