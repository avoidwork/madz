## Context

The vector store (`src/vector/store.js`) currently uses two tables: `code_chunks` (metadata + content) and `vec_code_chunks` (vector embeddings via sqlite-vec's vec0 virtual table). The indexer (`src/vector/indexer.js`) populates these during `reindex()`. The `codeSearch` tool queries via KNN vector similarity.

SQLite FTS5 is built into the same `better-sqlite3` dependency already used — no new packages needed. FTS5 virtual tables coexist with vec0 tables in the same database file.

## Goals / Non-Goals

**Goals:**
- Add FTS5 full-text search over indexed code chunk content
- Expose `fulltext` and `hybrid` modes in the `codeSearch` tool
- Implement Reciprocal Rank Fusion for hybrid result merging
- All changes backward-compatible (default mode remains `vector`)

**Non-Goals:**
- No new npm dependencies
- No changes to the embedding pipeline or vector index schema
- No changes to the `codeIndex` tool's public interface (only internal config passing)
- No web UI or API changes — tool-only

## Decisions

1. **FTS5 tokenizer: `porter unicode61`** — Provides stemming (porter) and Unicode-aware tokenization. Handles identifiers like `debian` and `codeSearch` correctly. Configurable via `ftsTokenize` in config.yaml.

2. **Separate FTS table, not a combined virtual table** — FTS5 is a virtual table that maintains its own inverted index. It cannot be combined with vec0. We create `fts_code_chunks` alongside the existing tables.

3. **RRF with k=60** — Standard RRF constant. Higher k gives more weight to lower-ranked results from each system. 60 is a well-tested default from information retrieval literature.

4. **FTS insert in same transaction as vector insert** — The indexer already wraps chunk insertion in a transaction. FTS insert joins that transaction for atomicity.

5. **`fulltext` config flag per project** — Optional boolean in `config.yaml` under `vector.projects.<name>`. Defaults to `false` to avoid unexpected index growth. When enabled, FTS table is populated during reindex.

## Risks / Trade-offs

- [FTS index size] → FTS5 inverted index adds ~50-100% overhead on content size. For code chunks this is negligible (typically <10MB total).
- [Stale FTS index] → Same mtime cache as vector index — incremental reindex keeps both in sync. Full reindex (`force: true`) rebuilds both.
- [FTS5 syntax injection] → Queries are parameterized via `better-sqlite3` prepared statements. FTS5 MATCH syntax (AND, OR, NEAR) is passed through as valid query syntax, not SQL injection.
