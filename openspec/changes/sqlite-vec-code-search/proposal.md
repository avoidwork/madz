## Why

Source code search is currently limited to grep-based text matching (`sessionSearch`), which misses semantically similar code. When debugging or implementing features, finding functionally similar code across files requires manual effort. Adding vector similarity search via sqlite-vec enables fast, local, semantic code retrieval without external vector databases.

## What Changes

- New `src/vector/` module with chunker, embedder, and vector store
- New `VectorConfigSchema` in `src/config/schemas/vector.js` for embedding model selection, chunk size/overlap, and sqlite path
- New `codeSearch` tool in `src/tools/codeSearch/` for semantic code queries
- Registration of `codeSearch` in tool registry (TOOLS, TOOL_PERMISSIONS, TOOL_CLASSIFICATIONS)
- Incremental indexing that tracks file mtimes to avoid redundant embedding
- Two new dependencies: `@photostructure/sqlite-vec` and `@xenova/transformers`
- Unit and integration tests for all new modules

## Capabilities

### New Capabilities
- `vector-store`: SQLite-backed vector storage using sqlite-vec vec0 virtual tables with cosine-distance KNN search, supporting insert, query, and incremental upsert by file path
- `code-search`: Semantic code search tool that embeds natural language queries and returns top-N matching code chunks with file paths and line numbers
- `code-chunking`: Fixed-size source code chunking with configurable overlap, binary detection, and file size limits
- `embedding`: Text embedding via transformers.js (local all-MiniLM-L6-v2, 384-dim) with OpenAI fallback (text-embedding-3-small, 1536-dim)
- `indexing`: Incremental project source code indexing with file mtime tracking to avoid redundant embedding

### Modified Capabilities
- (none — no existing spec-level behavior changes)

## Impact

- **New files**: `src/vector/chunker.js`, `src/vector/embedder.js`, `src/vector/store.js`, `src/vector/indexer.js`, `src/config/schemas/vector.js`, `src/tools/codeSearch/index.js`
- **Modified files**: `src/config/config.js`, `src/config/schemas/index.js`, `src/tools/index.js`, `package.json`
- **New dependencies**: `@photostructure/sqlite-vec` (v1.1.x), `@xenova/transformers` (v2.x)
- **New tests**: `tests/unit/vector/chunker.test.js`, `tests/unit/vector/store.test.js`, `tests/unit/tools/codeSearch.test.js`, `tests/integration/vector/full-flow.test.js`
- **No breaking changes**: All existing functionality remains unchanged
