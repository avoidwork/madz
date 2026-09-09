## 1. Dependencies & Configuration

- [x] 1.1 Add `@photostructure/sqlite-vec` and `@xenova/transformers` to package.json dependencies
- [x] 1.2 Create `VectorConfigSchema` in `src/config/schemas/vector.js` with Zod schema for embedding model, chunk size, chunk overlap, and vector db path
- [x] 1.3 Import and register `VectorConfigSchema` in `src/config/config.js` ConfigSchema

## 2. Core Vector Module

- [x] 2.1 Implement `src/vector/chunker.js` — split source files into fixed-size blocks with configurable overlap, skip binary files and files >500KB
- [x] 2.2 Implement `src/vector/embedder.js` — primary: transformers.js pipeline with `Xenova/all-MiniLM-L6-v2`, fallback: OpenAI `text-embedding-3-small`, return Float32Array
- [x] 2.3 Implement `src/vector/store.js` — SQLite vector store with `code_chunks` and `vec_code_chunks` virtual tables, insert, KNN query, incremental upsert by file path
- [x] 2.4 Implement `src/vector/indexer.js` — project source file scanner with mtime tracking, progress reporting, and re-index orchestration

## 3. Tool Integration

- [x] 3.1 Create `src/tools/codeSearch/index.js` — tool() wrapper with Zod input schema (query, topK, fileFilter), embeds query, runs KNN search, returns formatted results
- [x] 3.2 Register codeSearch in `src/tools/index.js` — add to TOOLS, TOOL_PERMISSIONS, TOOL_CLASSIFICATIONS, and ORCHESTRATOR_TOOLS

## 4. Indexing Command

- [x] 4.1 Add `--index-code` CLI flag to `index.js` that triggers full project indexing
- [x] 4.2 Implement incremental indexing logic that tracks file mtimes to avoid redundant embedding

## 5. Tests

- [x] 5.1 Write unit tests for chunker (`tests/unit/vector/chunker.test.js`)
- [x] 5.2 Write unit tests for embedder (`tests/unit/vector/embedder.test.js`)
- [x] 5.3 Write unit tests for store (`tests/unit/vector/store.test.js`)
- [x] 5.4 Write unit tests for codeSearch tool (`tests/unit/tools/codeSearch.test.js`)
- [x] 5.5 Write unit tests for indexer (`tests/unit/vector/indexer.test.js`)
- [x] 5.6 Write integration test (`tests/integration/vector/full-flow.test.js`)
