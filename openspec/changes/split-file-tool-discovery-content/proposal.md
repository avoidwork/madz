## Why

The `file` tool bundles path discovery (`ls`, `glob`), content search (`grep`, `search`), and content mutation (`read`, `write`, `edit`, `delete`) into one tool. This conflates three distinct access classes, making least-privilege grants impossible — granting `file` access grants read, write, and discovery all at once. Splitting along the access boundary lets a sandboxed context be granted discovery-only permissions without content read/write.

## What Changes

- **New `discovery` tool** exposing `ls` and `glob` actions (path listing only, no content read).
- **Simplify `file`** to content access only: `read`, `write`, `edit`, `delete`. Remove the `ls`/`glob`/`grep` actions and the stale `search` reference.
- **Break the cross-dependency** where `grep` imports `grepImpl` from `file/index.js`; move shared helpers to `common.js`.
- **Register `discovery`** in the tool registry with `["filesystem:read"]` permission.
- **BREAKING**: `file` no longer accepts `ls`, `glob`, `grep`, or `search` actions. Callers must use the `discovery` tool for `ls`/`glob` and the standalone `grep` tool for content search.

## Capabilities

### New Capabilities
- `discovery-tool`: A tool exposing `ls` and `glob` actions for path listing, gated by `filesystem:read` only.

### Modified Capabilities
- `own-file-tool`: The `file` tool's `action` enum narrows from `read, write, edit, delete, search, ls, glob, grep` to `read, write, edit, delete`. The `search`, `ls`, `glob`, and `grep` scenarios are removed; the `ls`/`glob` scenarios move to the `discovery-tool` capability and `grep`/`search` to the standalone `grep` tool.

## Impact

- `src/tools/common.js` — gains `grepImpl`, `nativeSearch`, `resolveBaseDir`, `resolveFilePath`.
- `src/tools/discovery/index.js` — new tool module.
- `src/tools/file/index.js` — simplified to content access only.
- `src/tools/grep/index.js` — imports `grepImpl` from `common.js`.
- `src/tools/index.js` — registers `discovery`.
- Tests: `tests/unit/tools/file.test.js`, `tests/integration/tools/file.test.js`, `tests/unit/tools/grep.test.js` updated; new `tests/unit/tools/discovery.test.js`, `tests/integration/tools/discovery.test.js`.

## Non-goals

- Not splitting `ls` and `glob` into separate tools (over-fragmentation).
- Not folding `grep` into `discovery` (grep reads content; discovery touches paths only).
- Not removing the `edit` action (it is not redundant with `write`).
