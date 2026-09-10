## MODIFIED Requirements

### Requirement: Vector store initializes schema on first use
The system SHALL create the `code_chunks` table, `vec_code_chunks` virtual table, and optionally the `fts_code_chunks` FTS5 virtual table when the vector store is first initialized.

#### Scenario: Schema creation on init
- **WHEN** the vector store is initialized
- **THEN** a `code_chunks` table exists with columns: `id INTEGER PRIMARY KEY`, `file_path TEXT NOT NULL`, `line_start INTEGER NOT NULL`, `line_end INTEGER NOT NULL`, `content TEXT NOT NULL`
- **AND** a `vec_code_chunks` virtual table exists using `vec0` with `id integer primary key`, `embedding float[384] distance_metric=cosine`
- **AND** when `fulltext: true`, an `fts_code_chunks` virtual table exists using FTS5 with `porter unicode61` tokenizer

### Requirement: Vector store inserts chunks with embeddings
The system SHALL accept a chunk with its embedding vector and insert it into all active tables atomically.

#### Scenario: Insert chunk with embedding
- **WHEN** a code chunk and its 384-dim Float32Array embedding are provided
- **THEN** a row is inserted into `code_chunks` with the chunk metadata
- **AND** a row is inserted into `vec_code_chunks` with the embedding
- **AND** when `fulltext: true`, a row is inserted into `fts_code_chunks` with the content

### Requirement: Vector store supports incremental upsert by file path
The system SHALL replace all chunks for a given file path when re-indexing, removing stale chunks from all active tables before inserting new ones.

#### Scenario: Upsert replaces old chunks for a file
- **WHEN** chunks are inserted for a file path that already has chunks in the store
- **THEN** all existing chunks for that file path are deleted from `code_chunks`, `vec_code_chunks`, and `fts_code_chunks` before the new chunks are inserted
