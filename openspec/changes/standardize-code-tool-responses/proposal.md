# Proposal

## Why

The `code` tool's implementation functions (`searchCodeImpl` and `indexCodeImpl`) currently return bare strings, making it impossible for consumers to reliably distinguish success from failure or to parse returned data programmatically. Structured responses enable consistent error propagation and reliable downstream processing by the orchestrator and other tools.

## What Changes

- `searchCodeImpl` (`src/tools/code/searchCode.js`) now returns `{ ok: true, results, count }` on success and `{ ok: false, error }` on failure, instead of bare strings.
- `indexCodeImpl` (`src/tools/code/indexCode.js`) now returns `{ ok: true, results }` on success and `{ ok: false, error }` on failure, where `results` is an array of per-project objects `{ name, indexed, skipped, errors }` (or `{ name, error }` for per-project failures).
- JSDoc `@returns` annotations updated to reflect structured object shapes.
- Unit tests updated to assert the new structured shapes.

## Capabilities

### New Capabilities
<!-- None — this is a modification of existing behavior, not a new capability. -->

### Modified Capabilities
- `code-search`: The `codeSearch tool returns structured results` requirement changes from returning a formatted string to returning a structured object `{ ok: true, results, count }`. The `codeSearch tool handles empty index gracefully` requirement changes from returning a message string to returning `{ ok: false, error }`.
- `piscina-worker-indexing`: The `indexCode returns formatted indexing results` requirement changes from returning a joined string to returning `{ ok: true, results }` with per-project objects. The `indexCode handles pool errors gracefully` requirement changes from returning an error string to returning a per-project `{ name, error }` entry.

## Impact

- **Code**: `src/tools/code/searchCode.js`, `src/tools/code/indexCode.js`
- **Tests**: `tests/unit/tools/codeSearch.test.js`, `tests/unit/tools/codeIndex.test.js`
- **Dependencies**: None — pure refactor, no new npm packages or system dependencies.

## Non-goals

- No change to the `searchCode` / `indexCode` tool wrappers or their zod schemas.
- No change to the vector store, embedder, Piscina pool, or indexer worker internals.
- No change to the search/index algorithms or result ranking.
