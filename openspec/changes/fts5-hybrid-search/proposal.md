## Why

The current vector search (`codeSearch`) is excellent for semantic similarity — it finds conceptually related code even when keywords don't match. However, it fails on exact string lookups: searching for "debian" returns semantically adjacent results but not actual occurrences. A developer often needs both: "find me the file that literally references `debian`" AND "find me code related to authentication." Hybrid search gives us both in a single query.

## What Changes

- Add an FTS5 virtual table `fts_code_chunks` to the vector store for full-text keyword search
- New store methods: `insertFtsChunks()`, `searchFts()`, `hybridSearch()`
- Indexer populates FTS5 table alongside vector table when `fulltext: true`
- `codeSearch` tool gains a `mode` parameter: `"vector"`, `"fulltext"`, or `"hybrid"`
- Hybrid mode merges vector + FTS results via Reciprocal Rank Fusion (RRF)
- Config gains optional `fulltext` and `ftsTokenize` keys per project
- No new npm dependencies — FTS5 is built into SQLite

## Capabilities

### New Capabilities
- `fts-search`: Full-text search over indexed code chunks using SQLite FTS5 with `porter unicode61` tokenizer
- `hybrid-search`: Combined vector + full-text search with Reciprocal Rank Fusion scoring

### Modified Capabilities
- `code-search`: Add `mode` parameter to support `fulltext` and `hybrid` modes alongside existing `vector` mode
- `vector-store`: Add FTS5 table creation, FTS insert/search/delete operations alongside existing vector operations

## Impact

- `src/vector/store.js` — FTS5 table, new methods, extended `removeFile()` and `init()`
- `src/vector/indexer.js` — accept `fulltext` option, populate FTS during reindex
- `src/tools/codeIndex/index.js` — pass `fulltext` from project config
- `src/tools/codeSearch/index.js` — add `mode` parameter, branch on mode
- `config.yaml` — add `fulltext` and `ftsTokenize` keys under `vector.projects`
- `tests/unit/` — new tests for FTS and hybrid search
