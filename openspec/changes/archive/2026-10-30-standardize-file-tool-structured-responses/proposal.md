# Proposal

## Why

The `file` tool's impl functions (`readImpl`, `writeImpl`, `editImpl`, `deleteImpl`, `fileImpl`) currently return bare strings — e.g. `Successfully wrote ...`, `Error: ...`, or file content as `line|text`. Consumers cannot reliably distinguish success from failure or parse returned data. Structured responses enable programmatic handling, consistent error propagation, and reliable downstream processing by the orchestrator and other tools.

## What Changes

- Convert `readImpl` to return `{ ok: true, content, lines }` on success and `{ ok: false, error }` on failure.
- Convert `writeImpl` to return `{ ok: true, path, bytesWritten }` on success and `{ ok: false, error }` on failure.
- Convert `editImpl` to return `{ ok: true, changes, diff }` on success and `{ ok: false, error, suggestions? }` on failure.
- Convert `deleteImpl` to return `{ ok: true, path }` on success and `{ ok: false, error }` on failure.
- Convert `fileImpl` to return `{ ok: false, error }` for unknown actions; success paths flow through the impls.
- Update JSDoc `@returns` annotations from `{Promise<string>}` to `{Promise<{ok: boolean, ...}>}`.
- Update unit and integration tests to assert structured object shapes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `own-file-tool`: The `file` tool SHALL return structured objects (`{ ok: true, ... }` / `{ ok: false, error: ... }`) from all impl functions instead of bare strings.

## Impact

- **Code**: `src/tools/file/index.js` — the five impl functions and their JSDoc.
- **Tests**: `tests/unit/tools/file.test.js`, `tests/integration/tools/file.test.js`.
- **Dependencies**: None — pure refactor, no new npm packages or system dependencies.
- **Consumers**: Any tool or orchestrator code that parses `file` tool output will now receive structured objects.

## Non-goals

- No change to path validation, size limits, fuzzy matching, or unified diff generation behavior.
- No new capabilities or tools.
- No change to the `process` tool or shell execution.
