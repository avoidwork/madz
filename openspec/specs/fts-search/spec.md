# fts-search Specification

## Purpose
TBD - created by archiving change fts5-hybrid-search. Update Purpose after archive.
## Requirements
### Requirement: FTS5 table is created on store initialization
The system SHALL create an FTS5 virtual table `fts_code_chunks` when the vector store is initialized and the project has `fulltext: true`.

#### Scenario: FTS5 table creation on init
- **WHEN** the vector store is initialized with a project that has `fulltext: true`
- **THEN** a `fts_code_chunks` virtual table exists using FTS5 with `porter unicode61` tokenizer
- **AND** the table has columns: `file_path UNINDEXED`, `content`

### Requirement: FTS search returns ranked results
The system SHALL support full-text search queries against the FTS5 index, returning results ranked by FTS5 relevance.

#### Scenario: Basic FTS query
- **WHEN** a user invokes `codeSearch` with `mode: "fulltext"` and a query string
- **THEN** the system returns up to K results ranked by FTS5 relevance score
- **AND** each result includes `file_path`, `line_start`, `line_end`, `content`, and `rank`

#### Scenario: FTS query with special syntax
- **WHEN** a user invokes `codeSearch` with `mode: "fulltext"` and a query containing FTS5 operators (AND, OR, NEAR, phrases)
- **THEN** the system interprets the operators according to FTS5 query syntax
- **AND** returns results matching the compound query

### Requirement: FTS index is populated during reindex
The system SHALL populate the FTS5 table during the indexing pipeline when `fulltext: true`.

#### Scenario: FTS population during reindex
- **WHEN** the indexer runs `reindex()` with `fulltext: true`
- **THEN** each chunk's content is inserted into the `fts_code_chunks` table
- **AND** the insert is part of the same transaction as the vector insert

### Requirement: FTS entries are removed on file deletion
The system SHALL remove FTS entries when a file is removed from the index.

#### Scenario: FTS cleanup on file removal
- **WHEN** `removeFile()` is called for a file path
- **THEN** all FTS entries for that file path are deleted
- **AND** the deletion is in the same transaction as the vector table deletion

