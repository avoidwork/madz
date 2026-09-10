## ADDED Requirements

### Requirement: Hybrid search merges vector and FTS results via RRF
The system SHALL support a hybrid search mode that runs both vector and FTS queries and merges results via Reciprocal Rank Fusion (RRF).

#### Scenario: Hybrid search returns combined results
- **WHEN** a user invokes `codeSearch` with `mode: "hybrid"` and a query string
- **THEN** the system runs both a vector KNN search and an FTS5 MATCH search
- **AND** merges results using RRF with configurable k (default 60)
- **AND** returns combined results with source annotation (`vector`, `fulltext`, or `both`)

#### Scenario: Hybrid search with only vector matches
- **WHEN** a hybrid search is performed and the FTS query returns no results
- **THEN** the system returns only the vector search results
- **AND** each result is annotated with source `vector`

#### Scenario: Hybrid search with only FTS matches
- **WHEN** a hybrid search is performed and the vector query returns no results
- **THEN** the system returns only the FTS search results
- **AND** each result is annotated with source `fulltext`

### Requirement: Hybrid search deduplicates results
The system SHALL deduplicate results that appear in both vector and FTS result sets, using file path + line range as the deduplication key.

#### Scenario: Deduplication of overlapping results
- **WHEN** the same code chunk appears in both vector and FTS results
- **THEN** the chunk appears once in the merged results
- **AND** its source is annotated as `both`
- **AND** its RRF score reflects contributions from both rankings
