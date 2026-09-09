## ADDED Requirements

### Requirement: Vector store initializes schema on first use
The system SHALL create the `code_chunks` table and `vec_code_chunks` virtual table when the vector store is first initialized.

#### Scenario: Schema creation on init
- **WHEN** the vector store is initialized
- **THEN** a `code_chunks` table exists with columns: `id INTEGER PRIMARY KEY`, `file_path TEXT NOT NULL`, `line_start INTEGER NOT NULL`, `line_end INTEGER NOT NULL`, `content TEXT NOT NULL`
- **AND** a `vec_code_chunks` virtual table exists using `vec0` with `id integer primary key`, `embedding float[384] distance_metric=cosine`

### Requirement: Vector store inserts chunks with embeddings
The system SHALL accept a chunk with its embedding vector and insert it into both tables atomically.

#### Scenario: Insert chunk with embedding
- **WHEN** a code chunk and its 384-dim Float32Array embedding are provided
- **THEN** a row is inserted into `code_chunks` with the chunk metadata
- **AND** a row is inserted into `vec_code_chunks` with the embedding

### Requirement: Vector store queries via KNN MATCH
The system SHALL support KNN queries using the `vec0` virtual table `MATCH` syntax, returning results joined with chunk metadata.

#### Scenario: KNN query returns top-N results
- **WHEN** a query embedding vector and a top-K value are provided
- **THEN** the system returns up to K results, each with `id`, `file_path`, `line_start`, `line_end`, `content`, and `distance`
- **AND** results are ordered by ascending distance

### Requirement: Vector store supports incremental upsert by file path
The system SHALL replace all chunks for a given file path when re-indexing, removing stale chunks before inserting new ones.

#### Scenario: Upsert replaces old chunks for a file
- **WHEN** chunks are inserted for a file path that already has chunks in the store
- **THEN** all existing chunks for that file path are deleted before the new chunks are inserted
