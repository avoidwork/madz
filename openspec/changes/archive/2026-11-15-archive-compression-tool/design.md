# Design

## Context

See proposal.md - Why. The harness has ZIP extraction for document formats (`src/tools/fileExtract/zipExtractor.js` via `adm-zip`) but no general-purpose archive tool. The new `archive` tool must not duplicate that path. It follows the established tool convention in `src/tools/git/index.js`: the export is the tool name itself (`export const archive = tool(...)`), with `archiveImpl` as the implementation.

## Goals / Non-Goals

**Goals:**
- Provide `create`, `extract`, and `list` operations across `zip`, `tar`, and `gzip`.
- Enforce the sandbox allowlist on source/destination paths via `validatePath()` from `src/tools/common.js`.
- Protect against path traversal during extraction (A01 Broken Access Control).
- Register the tool in `src/tools/index.js` with correct permissions and classifications.

**Non-Goals:**
- Not modifying `fileExtract` / `file-extraction` — that stays scoped to document formats.
- Not adding archive support to the `process` tool.

## Decisions

### Decision 1: Tool export convention
Follow the `git` tool convention exactly: `export const archive = tool((input, options = {}) => archiveImpl(input, options), { name: "archive", description, schema })`. Do **not** use a `createArchiveTool()` factory. This matches the audit findings and keeps the tool consistent with the rest of the registry.

### Decision 2: Libraries
- **`archiver`** (v7.x+) for archive **creation** (zip, tar, gzip). It is the standard, widely-used Node library for creating archives.
- **`unzipper`** (v0.12+) for **zip extraction**. It provides entry listing and safe extraction.
- **`tar`** (v7.x+) for **tar/gzip extraction**. It handles tar and gzip streams and supports path-traversal-safe extraction.

Alternatives considered: shelling out via `process` (rejected — shell injection risk, no validation); extending `fileExtract` (rejected — that tool is scoped to document content).

### Decision 3: Path validation
Reuse `validatePath()` from `src/tools/common.js` for source/destination paths. For extraction, validate every entry path against the allowlist before writing, and reject entries that would escape the destination directory (path traversal). This mirrors how the `file` tool enforces the sandbox.

### Decision 4: Registry wiring
Add `archive` to `src/tools/index.js`:
- Import from `./archive/index.js`
- `TOOL_PERMISSIONS`: `archive: ["filesystem:read", "filesystem:write"]`
- `TOOL_CLASSIFICATIONS`: `archive: ["search", "research", "coding", "documentation", "debug"]`
- `TOOLS` map
- `case "archive"` in `buildToolConfig()`

## Risks / Trade-offs

- [Path traversal on extract] → Validate every extracted entry path against the allowlist; reject entries that escape the destination.
- [Empty archives] → Handle gracefully, returning an empty result rather than throwing.
- [Unsupported formats] → Zod schema rejects unsupported formats before processing.
- [Large archives] → Stream where possible; rely on `archiver`/`tar`/`unzipper` streaming APIs to avoid loading whole archives into memory.
