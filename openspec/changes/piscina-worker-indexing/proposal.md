## Why

The `indexCode` tool performs all indexing work — scanning source files, chunking content, generating embeddings, and writing to the vector store — inline on the main event loop. This blocks the main loop while processing potentially thousands of files, degrading responsiveness of the harness. Moving this work to a Piscina worker pool offloads it from the main thread.

## What Changes

- Add a new worker entry file `src/vector/indexer.worker.js` that accepts plain project config and creates the store + embedder internally, then calls `reindex`.
- Modify `indexCodeImpl` in `src/tools/code/indexCode.js` to dispatch the project config to a Piscina pool and await the result, instead of calling `reindex` inline.
- Preserve the existing `indexCode` tool schema (`project`, `force`) and the `${name}: ${indexed} indexed, ...` return format.
- Add `piscina` (^5.3.2) to package.json dependencies.
- Handle pool errors gracefully, returning `${name}: error — ${err.message}` on failure.

## Capabilities

### New Capabilities

- `piscina-worker-indexing`: Defines the behavior of offloading the `indexCode` indexing work to a Piscina worker pool. The worker entry file accepts plain project config (dbPath, rootDir, include, exclude, chunkSize, chunkOverlap, maxFileSize, force) and creates the store + embedder internally before calling `reindex`. The `indexCodeImpl` dispatches config to the pool and formats results.

### Modified Capabilities

- `indexing`: The `indexCode` tool no longer runs indexing inline on the main event loop. It dispatches the project config to a Piscina worker pool and awaits the result. The return format and tool schema are preserved.

## Impact

- **Affected code:** `src/tools/code/indexCode.js` (dispatch to pool), new `src/vector/indexer.worker.js` (worker entry).
- **No API changes:** The `indexCode` tool schema (`project`, `force`) and return format are unchanged.
- **Dependency changes:** Add `piscina` (^5.3.2) to `package.json` dependencies.
- **Test impact:** Add `tests/unit/tools/codeIndex.test.js` mocking the Piscina pool's `run` method.

## Non-goals

- No changes to the `reindex` function's core logic (scanning, chunking, embedding, mtime cache).
- No changes to `searchCode`.
- No changes to the `indexCode` tool schema.
- No changes to `config.yaml` `vector.projects` (it stays `{}` by default).
