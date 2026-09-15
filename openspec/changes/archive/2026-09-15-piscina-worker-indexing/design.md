## Context

The `indexCode` tool (`src/tools/code/indexCode.js`) currently performs all indexing work inline on the main event loop. It calls `reindex(store, embedder, options)` directly, where `store` is a vector store wrapping a `better-sqlite3` Database (native handle) and `embedder` wraps a `@xenova/transformers` pipeline. Both are created in the main thread and passed to `reindex`.

The `reindex` function (`src/vector/indexer.js`, line 208) scans source files, chunks content, generates embeddings, and writes to the vector store. For large projects this blocks the main event loop for the duration of the scan/chunk/embed cycle.

## Goals / Non-Goals

**Goals:**
- Move the indexing work off the main event loop by running it in a Piscina worker pool.
- Create a worker entry file that accepts plain project config and creates the store + embedder internally.
- Preserve the `indexCode` tool schema (`project`, `force`) and the `${name}: ${indexed} indexed, ...` return format.
- Handle pool errors gracefully.

**Non-Goals:**
- No changes to the `reindex` function's core logic.
- No changes to `searchCode`.
- No changes to the `indexCode` tool schema.
- No changes to `config.yaml` `vector.projects`.

## Decisions

### Decision 1: Worker creates store + embedder internally

**Choice:** The worker entry file (`src/vector/indexerWorker.js`) accepts a plain config object and creates the store + embedder internally, then calls `reindex`.

**Rationale:** `store` (better-sqlite3 Database) and `embedder` (@xenova/transformers pipeline) are NOT structured-cloneable across worker threads. Passing them via `postMessage` would fail with a DataCloneError. The only viable approach is to pass plain serializable config (dbPath, rootDir, include, exclude, chunkSize, chunkOverlap, maxFileSize, force) and reconstruct the store + embedder inside the worker.

**Alternatives considered:**
- Pass store/embedder directly: Impossible — native handles are not cloneable.
- Serialize the store/embedder: Not feasible — they hold native resources.

### Decision 2: Piscina pool created once at module scope

**Choice:** The Piscina pool is instantiated once at module scope in `indexCode.js` and reused across calls.

**Rationale:** Creating a pool per call would spawn threads repeatedly, adding overhead. A module-scope pool is reused for the lifetime of the process, matching the tool's long-lived server context. Piscina manages its own thread lifecycle; no explicit `destroy()` is required.

**Alternatives considered:**
- Create pool per call: Higher overhead, thread churn.

### Decision 3: Error handling per project

**Choice:** Each project's `pool.run(config)` is wrapped in a try/catch. On failure, the result is `${name}: error — ${err.message}`.

**Rationale:** This preserves the existing graceful-degradation behavior of the tool — one project failing does not abort the whole batch.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Each worker thread loads its own embedder pipeline (memory cost) | Pool is bounded; acceptable trade-off since native handles cannot be shared |
| Worker file path resolution across ESM | Use `new URL("../../vector/indexerWorker.js", import.meta.url).href` for robust resolution |
| Pool errors surface as rejected promises | Catch per-project and format as `${name}: error — ${err.message}` |
| `indexCode.js` loads config at import time | Tests must mock the config loader or inject config; the pool's `run` is mocked via `mock.method` |
